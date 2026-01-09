package modules.utils;

public class C {
  public enum N {
    RESET("\u001B[0m"),
    RED("\u001B[31m"),
    GREEN("\u001B[32m"),
    YELLOW("\u001B[33m"),
    BLUE("\u001B[34m"),
    WHITE("\u001B[37m");

    private final String code;

    N(String code) {
      this.code = code;
    }

    public String getCode() {
      return code;
    }
  }

  public static void println(String message, N color) {
      System.out.println(color.getCode() + message + N.RESET.getCode());
  }
}