package com.hbg.psu.ms_padashboard.controller;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/purpleair")
@RequiredArgsConstructor
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:3000"
})
public class PurpleAirController {

    private static final String UPSTREAM = "https://api.purpleair.com/v1";
    private static final long CURRENT_TTL_MS = 60_000;
    private static final long HISTORY_TTL_MS = 600_000;
    private static final long TIME_ROUNDING_SECONDS = 600;
    private static final int MAX_CACHE_ENTRIES = 500;

    private static final Pattern FIELDS = Pattern.compile("^[A-Za-z0-9_.,]+$");
    private static final Pattern READ_KEY = Pattern.compile("^[A-Za-z0-9-]+$");
    private static final Pattern NUMBER = Pattern.compile("^\\d{1,12}$");

    private record Entry(long expiresAt, int status, String contentType, byte[] body) {}

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    @Value("${purpleair.api-key:}")
    private String apiKey;

    /**
     * Get sensor data
     * @param index
     * @param fields
     * @param readKey
     * @return sensor info
     */
    @GetMapping("/sensors/{index:\\d+}")
    public ResponseEntity<byte[]> sensor(
        @PathVariable String index,
        @RequestParam(required = false) String fields,
        @RequestParam(name = "read_key", required = false) String readKey) {
        return proxy("/sensors/" + index, params(fields, readKey, null, null, null), CURRENT_TTL_MS);
    }

    /**
     * Get sensor history
     * @param index
     * @param fields
     * @param average
     * @param start
     * @param end
     * @param readKey
     * @return sensor history in json format
     */
    @GetMapping("/sensors/{index:\\d+}/history")
    public ResponseEntity<byte[]> history(
        @PathVariable String index,
        @RequestParam(required = false) String fields,
        @RequestParam(required = false) String average,
        @RequestParam(name = "start_timestamp", required = false) String start,
        @RequestParam(name = "end_timestamp", required = false) String end,
        @RequestParam(name = "read_key", required = false) String readKey) {
        return proxy("/sensors/" + index + "/history", params(fields, readKey, average, start, end), HISTORY_TTL_MS);
    }

    /**
     * Get sensor history as CSV
     * @param index
     * @param fields
     * @param average
     * @param start
     * @param end
     * @param readKey
     * @return csv file
     */
    @GetMapping("/sensors/{index:\\d+}/history/csv")
    public ResponseEntity<byte[]> historyCsv(
        @PathVariable String index,
        @RequestParam(required = false) String fields,
        @RequestParam(required = false) String average,
        @RequestParam(name = "start_timestamp", required = false) String start,
        @RequestParam(name = "end_timestamp", required = false) String end,
        @RequestParam(name = "read_key", required = false) String readKey) {
        return proxy("/sensors/" + index + "/history/csv", params(fields, readKey, average, start, end), HISTORY_TTL_MS);
    }

    /**
     * Map parameters to corresponding fields
     * @param fields
     * @param readKey
     * @param average
     * @param start
     * @param end
     * @return parameters
     */
    private Map<String, String> params(String fields, String readKey, String average, String start, String end) {
        Map<String, String> p = new TreeMap<>();
        if (fields != null && !fields.isBlank()) {
            if (!FIELDS.matcher(fields).matches()) return null;
            p.put("fields", fields);
        }
        if (readKey != null && !readKey.isBlank()) {
            if (!READ_KEY.matcher(readKey).matches()) return null;
            p.put("read_key", readKey);
        }
        if (average != null && !average.isBlank()) {
            if (!NUMBER.matcher(average).matches()) return null;
            p.put("average", average);
        }
        if (start != null && !start.isBlank()) {
            if (!NUMBER.matcher(start).matches()) return null;
            p.put("start_timestamp", String.valueOf(round(Long.parseLong(start))));
        }
        if (end != null && !end.isBlank()) {
            if (!NUMBER.matcher(end).matches()) return null;
            p.put("end_timestamp", String.valueOf(round(Long.parseLong(end))));
        }
        return p;
    }

    // Round time
    private static long round(long seconds) {
        return (seconds / TIME_ROUNDING_SECONDS) * TIME_ROUNDING_SECONDS;
    }

    private ResponseEntity<byte[]> proxy(String path, Map<String, String> params, long ttlMs) {
        if (params == null) {
            return error(HttpStatus.BAD_REQUEST, "Invalid request parameters.");
        }
        if (apiKey == null || apiKey.isBlank()) {
            return error(HttpStatus.SERVICE_UNAVAILABLE,
                "PurpleAir API key is not configured on the server (set PURPLEAIR_API_KEY).");
        }

        String query = params.entrySet().stream()
            .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
            .collect(Collectors.joining("&"));
        String url = UPSTREAM + path + (query.isEmpty() ? "" : "?" + query);

        long now = System.currentTimeMillis();
        Entry hit = cache.get(url);
        if (hit != null && hit.expiresAt() > now) {
            return respond(hit);
        }

        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("X-API-Key", apiKey)
                .timeout(Duration.ofSeconds(20))
                .GET()
                .build();
            HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            String contentType = res.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse("application/json");
            Entry entry = new Entry(now + ttlMs, res.statusCode(), contentType, res.body());
            if (res.statusCode() / 100 == 2) { // only cache successes
                if (cache.size() >= MAX_CACHE_ENTRIES) {
                    cache.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
                    if (cache.size() >= MAX_CACHE_ENTRIES) cache.clear();
                }
                cache.put(url, entry);
            }
            return respond(entry);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return error(HttpStatus.BAD_GATEWAY, "PurpleAir request was interrupted.");
        } catch (IOException e) {
            return error(HttpStatus.BAD_GATEWAY, "Could not reach PurpleAir.");
        }
    }

    private static ResponseEntity<byte[]> respond(Entry e) {
        return ResponseEntity.status(e.status())
            .header(HttpHeaders.CONTENT_TYPE, e.contentType())
            .body(e.body());
    }

    private static ResponseEntity<byte[]> error(HttpStatus status, String message) {
        String json = "{\"description\":\"" + message.replace("\"", "'") + "\"}";
        return ResponseEntity.status(status)
            .header(HttpHeaders.CONTENT_TYPE, "application/json")
            .body(json.getBytes(StandardCharsets.UTF_8));
    }
}
