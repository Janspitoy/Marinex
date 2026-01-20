export function exportGPXClient(route) {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n`;

    const trkpts = route.points
        .map((p) => {
            const time = p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString();
            return `  <trkpt lat="${p.lat}" lon="${p.lng}">\n    <time>${time}</time>\n    <extensions>\n      <speed>${(p.speed || 0).toFixed(2)}</speed>\n    </extensions>\n  </trkpt>`;
        })
        .join("\n");

    const gpx = `${xmlHeader}<gpx version="1.1" creator="Marinex">
  <trk>
    <name>${route.name || "Route"}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    return URL.createObjectURL(blob);
}
