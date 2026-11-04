package okedge.apksign;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.SignatureException;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * The two runs' files (DeviceKeyProvider): RECORD appends each digest asked for (hex, a line) to OKSIGN_RECORD and
 * answers zeros; REPLAY answers each digest from OKSIGN_REPLAY ("digest signature" a line, hex) - a digest the key did
 * not sign is refused, so nothing unapproved is ever put in the APK.
 */
final class Signatures {

  private static final HexFormat HEX = HexFormat.of();
  private static Map<String, byte[]> replay;

  private Signatures() {}

  static boolean recording() {
    String r = System.getenv("OKSIGN_RECORD");
    return r != null && !r.isEmpty();
  }

  static synchronized byte[] answer(byte[] digest, int signatureBytes) throws SignatureException {
    String d = HEX.formatHex(digest);
    try {
      if (recording()) {
        Files.write(Paths.get(System.getenv("OKSIGN_RECORD")), (d + "\n").getBytes(StandardCharsets.US_ASCII),
            StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        return new byte[signatureBytes];
      }
      if (replay == null) replay = load(System.getenv("OKSIGN_REPLAY"));
    } catch (IOException e) {
      throw new SignatureException("the signatures file: " + e.getMessage(), e);
    }
    byte[] sig = replay.get(d);
    if (sig == null) throw new SignatureException("the key signed no digest " + d.substring(0, 16) + " - was it asked for in the record run?");
    return sig;
  }

  private static Map<String, byte[]> load(String path) throws IOException {
    if (path == null || path.isEmpty()) throw new IOException("neither OKSIGN_RECORD nor OKSIGN_REPLAY is set");
    Map<String, byte[]> out = new HashMap<>();
    List<String> lines = Files.readAllLines(Paths.get(path), StandardCharsets.US_ASCII);
    for (String line : lines) {
      String[] parts = line.trim().split("\\s+");
      if (parts.length == 2) out.put(parts[0].toLowerCase(), HEX.parseHex(parts[1]));
    }
    return out;
  }
}
