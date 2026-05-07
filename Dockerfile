# Multi-stage build for CMNetwork Web API on Render
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Install Node.js (LTS) so the MSBuild SPA build target can run npm ci + npm run build
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy source and publish the Web API project
COPY . .
RUN dotnet restore src/CMNetwork.WebApi/CMNetwork.WebApi.csproj
RUN dotnet publish src/CMNetwork.WebApi/CMNetwork.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
# Render injects PORT at runtime. Default keeps local docker runs simple.
ENV PORT=10000

EXPOSE 10000

# Bind Kestrel to the Render-provided port.
ENTRYPOINT ["sh", "-c", "dotnet CMNetwork.WebApi.dll --urls http://0.0.0.0:${PORT}"]
