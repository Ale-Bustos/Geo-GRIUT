# Imagen del backend de Geo-GRIUT: binario estático de Go sobre distroless (sin shell)
FROM golang:1.27-alpine AS compilar
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=compilar /api /api
EXPOSE 8081
USER nonroot:nonroot
ENTRYPOINT ["/api"]
