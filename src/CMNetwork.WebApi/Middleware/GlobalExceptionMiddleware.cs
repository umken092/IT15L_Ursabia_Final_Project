using System.Net;
using System.Text.Json;

namespace CMNetwork.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next   = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var code    = HttpStatusCode.InternalServerError;
        var message = "An unexpected error occurred. Please try again later.";

        if (exception is KeyNotFoundException)
        {
            code    = HttpStatusCode.NotFound;
            message = exception.Message;
        }
        else if (exception is UnauthorizedAccessException)
        {
            code    = HttpStatusCode.Unauthorized;
            message = "You are not authorized to perform this action.";
        }
        else if (exception is InvalidOperationException)
        {
            code    = HttpStatusCode.BadRequest;
            message = exception.Message;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode  = (int)code;

        var payload = JsonSerializer.Serialize(new
        {
            status  = (int)code,
            message,
            traceId = context.TraceIdentifier
        });

        return context.Response.WriteAsync(payload);
    }
}
