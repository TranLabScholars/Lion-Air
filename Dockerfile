# build the React app
FROM node:24-alpine AS frontend
WORKDIR /webapp
COPY webapp/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY webapp/ ./
RUN npm run build

# build the backend
FROM maven:3.9-eclipse-temurin-25 AS backend
WORKDIR /app
COPY ms_padashboard/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY ms_padashboard/src ./src
COPY --from=frontend /webapp/build ./src/main/resources/static
RUN mvn -B -q clean package -DskipTests

# run
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=backend /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} $JAVA_OPTS -jar app.jar"]
