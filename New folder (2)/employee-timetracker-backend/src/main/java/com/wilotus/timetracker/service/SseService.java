package com.wilotus.timetracker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class SseService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper()
            .findAndRegisterModules(); // handles LocalDateTime serialization

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(()   -> emitters.remove(emitter));
        emitter.onError(e      -> emitters.remove(emitter));

        // Send a keep-alive on connect so client knows it's connected
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (Exception e) {
            emitters.remove(emitter);
        }

        log.debug("SSE client connected. Total connections: {}", emitters.size());
        return emitter;
    }

    // Broadcast live attendance update to all connected dashboards
    public void broadcastLive(Object data) {
        if (emitters.isEmpty()) return;

        List<SseEmitter> dead = new CopyOnWriteArrayList<>();
        String json;
        try {
            json = objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            log.error("SSE serialize error", e);
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("attendance").data(json));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
        log.debug("SSE broadcast sent to {} clients", emitters.size() - dead.size());
    }

    // Keep-alive ping every 20 seconds to prevent connection drop
    @Scheduled(fixedDelay = 20_000)
    public void keepAlive() {
        List<SseEmitter> dead = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("ping").data(""));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }

    public int getConnectionCount() {
        return emitters.size();
    }
}
