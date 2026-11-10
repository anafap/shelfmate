FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json .
COPY backend/ backend/
RUN dotnet publish backend/src/ShelfMate.Api/ShelfMate.Api.csproj \
    -c Release -o /app/publish --self-contained false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "ShelfMate.Api.dll"]
