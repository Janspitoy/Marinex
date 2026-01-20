export function exportKMLClient(route) {
    const coords = route.points.map((p) => `${p.lng},${p.lat},0`).join(" ");
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${route.name || "Route"}</name>
    <Placemark>
      <LineString>
        <coordinates>
          ${coords}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
    const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    return URL.createObjectURL(blob);
}
