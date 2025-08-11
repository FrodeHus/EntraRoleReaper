# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Restore first to leverage layer caching
COPY EntraRoleReaper.sln ./
COPY server/EntraRoleReaper.Api.csproj server/EntraRoleReaper.Api.csproj
RUN dotnet restore server/EntraRoleReaper.Api.csproj

# Copy the rest of the source
COPY server/ ./server/

# Publish
WORKDIR /src/server
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final

# Create non-root user
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# Copy published output
COPY --from=build /app/publish ./
COPY --from=build /src/server/Data ./Data

# App configuration
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

# Least privilege
USER app
ENTRYPOINT ["dotnet", "EntraRoleReaper.Api.dll"]
