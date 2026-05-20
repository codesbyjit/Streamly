package main

import (
    "fmt"
    "log"
    "net"

    "github.com/nareix/joy4/format/rtmp"
)

func main() {
    server := &rtmp.Server{}

    server.HandlePublish = func(conn *rtmp.Conn, streamID string) {
        log.Printf("Stream published: %s from %s", streamID, conn.NetConn.RemoteAddr())

        stream, err := validateStreamKey(streamID)
        if err != nil {
            log.Printf("Invalid stream key: %s", streamID)
            conn.Close()
            return
        }

        updateStreamStatus(stream.ID, "live")

        go processLiveStream(conn, stream)
    }

    server.HandlePlay = func(conn *rtmp.Conn, streamID string) {
        log.Printf("Viewer connected to: %s", streamID)
    }

    log.Println("RTMP server starting on :1935")
    if err := server.ListenAndServe(); err != nil {
        log.Fatal(err)
    }
}