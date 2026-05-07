# Stage 1: Build the React SPA
FROM node:lts-alpine AS spa-build
WORKDIR /spa
COPY src/CMNetwork.ClientApp/package*.json ./
RUN npm ci
COPY src/CMNetwork.ClientApp/ ./
RUN npm run build

# Stage 2: Build the .NET Web API (skip the MSBuild SPA target — already built above)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore src/CMNetwork.WebApi/CMNetwork.WebApi.csproj
RUN dotnet publish src/CMNetwork.WebApi/CMNetwork.WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false /p:SkipSpaBuild=true

# Copy the pre-built SPA dist into the publish wwwroot
COPY --from=spa-build /spa/dist /app/publish/wwwroot

# Stage 3: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=10000

EXPOSE 10000

ENTRYPOINT ["sh", "-c", "dotnet CMNetwork.WebApi.dll --urls http://0.0.0.0:${PORT}"]
