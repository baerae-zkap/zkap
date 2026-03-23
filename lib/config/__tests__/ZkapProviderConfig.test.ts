import { ZkapProviderConfig } from "../ZkapProviderConfig";
import { PRESETS } from "../presets";
import type { ZkapProviderConfigOptions } from "../ZkapProviderConfig";

describe("ZkapProviderConfig", () => {
  describe("fromPreset", () => {
    it("should load embedded-zkap preset by default", () => {
      const config = ZkapProviderConfig.fromPreset();
      expect(config.getClientId("GOOGLE")).toBe(
        PRESETS["embedded-zkap"].providers.GOOGLE.clientId
      );
      expect(config.getClientId("KAKAO")).toBe(
        PRESETS["embedded-zkap"].providers.KAKAO.clientId
      );
    });

    it("should load embedded-zkap preset explicitly", () => {
      const config = ZkapProviderConfig.fromPreset("embedded-zkap");
      expect(config.getClientId("GOOGLE")).toContain("193471906673");
    });

    it("should load zkap-web3 preset", () => {
      const config = ZkapProviderConfig.fromPreset("zkap-web3");
      expect(config.getClientId("GOOGLE")).toContain("339888083889");
    });

    it("should throw on unknown preset", () => {
      expect(() =>
        ZkapProviderConfig.fromPreset("unknown" as any)
      ).toThrow("Unknown preset: unknown");
    });
  });

  describe("custom", () => {
    const customConfig: ZkapProviderConfigOptions = {
      providers: {
        GOOGLE: { clientId: "my-google-id", hAud: "0xAAA" },
        KAKAO: { clientId: "my-kakao-id", hAud: "0xBBB" },
        APPLE: { clientId: "my-apple-id", hAud: "0xCCC" },
      },
      hAudLists: "0xDDD",
      hAudLists1: "0xEEE",
    };

    it("should use custom values", () => {
      const config = ZkapProviderConfig.custom(customConfig);
      expect(config.getClientId("GOOGLE")).toBe("my-google-id");
      expect(config.getClientId("KAKAO")).toBe("my-kakao-id");
      expect(config.getClientId("APPLE")).toBe("my-apple-id");
      expect(config.getHAud("GOOGLE")).toBe("0xAAA");
      expect(config.getHAudLists()).toBe("0xDDD");
      expect(config.getHAudLists1()).toBe("0xEEE");
    });
  });

  describe("getters", () => {
    const config = ZkapProviderConfig.fromPreset("embedded-zkap");

    it("getClientId returns correct value per provider", () => {
      expect(config.getClientId("GOOGLE")).toBeTruthy();
      expect(config.getClientId("KAKAO")).toBeTruthy();
    });

    it("getHAud returns hex string", () => {
      expect(config.getHAud("GOOGLE")).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(config.getHAud("KAKAO")).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("getHAudLists returns hex string", () => {
      expect(config.getHAudLists()).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("getHAudLists1 returns hex string", () => {
      expect(config.getHAudLists1()).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("getProviderEntry returns full entry", () => {
      const entry = config.getProviderEntry("GOOGLE");
      expect(entry).toHaveProperty("clientId");
      expect(entry).toHaveProperty("hAud");
    });

    it("getProviderEntry throws on unknown provider", () => {
      expect(() =>
        config.getProviderEntry("FACEBOOK" as any)
      ).toThrow("Unknown provider: FACEBOOK");
    });
  });

  describe("toJSON", () => {
    it("returns serializable config", () => {
      const config = ZkapProviderConfig.fromPreset("embedded-zkap");
      const json = config.toJSON();

      expect(json.providers).toBeDefined();
      expect(json.providers.GOOGLE).toBeDefined();
      expect(json.providers.KAKAO).toBeDefined();
      expect(json.providers.APPLE).toBeDefined();
      expect(json.hAudLists).toBeTruthy();
      expect(json.hAudLists1).toBeTruthy();
    });

    it("roundtrip: custom(toJSON()) produces same values", () => {
      const original = ZkapProviderConfig.fromPreset("zkap-web3");
      const roundtrip = ZkapProviderConfig.custom(original.toJSON());

      expect(roundtrip.getClientId("GOOGLE")).toBe(original.getClientId("GOOGLE"));
      expect(roundtrip.getClientId("KAKAO")).toBe(original.getClientId("KAKAO"));
      expect(roundtrip.getHAudLists()).toBe(original.getHAudLists());
      expect(roundtrip.getHAudLists1()).toBe(original.getHAudLists1());
    });
  });

  describe("Apple provider (not yet configured)", () => {
    it("throws when getting Apple clientId (empty in preset)", () => {
      const config = ZkapProviderConfig.fromPreset("embedded-zkap");
      expect(() => config.getClientId("APPLE")).toThrow(
        "Provider APPLE has no clientId configured"
      );
    });

    it("getProviderEntry returns entry with empty values", () => {
      const config = ZkapProviderConfig.fromPreset("embedded-zkap");
      const entry = config.getProviderEntry("APPLE");
      expect(entry.clientId).toBe("");
      expect(entry.hAud).toBe("");
    });
  });

  describe("toJSON deep copy", () => {
    it("mutations on toJSON output do not affect internal state", () => {
      const config = ZkapProviderConfig.fromPreset("embedded-zkap");
      const json = config.toJSON();
      const originalClientId = json.providers.GOOGLE.clientId;

      // mutate the copy
      json.providers.GOOGLE.clientId = "mutated";

      // internal state should be unchanged
      expect(config.getClientId("GOOGLE")).toBe(originalClientId);
    });
  });

  describe("presets have different values", () => {
    it("embedded-zkap and zkap-web3 have different Google clientIds", () => {
      const embeddedConfig = ZkapProviderConfig.fromPreset("embedded-zkap");
      const web3Config = ZkapProviderConfig.fromPreset("zkap-web3");

      expect(embeddedConfig.getClientId("GOOGLE")).not.toBe(
        web3Config.getClientId("GOOGLE")
      );
    });

    it("embedded-zkap and zkap-web3 have different hAudLists", () => {
      const embeddedConfig = ZkapProviderConfig.fromPreset("embedded-zkap");
      const web3Config = ZkapProviderConfig.fromPreset("zkap-web3");

      expect(embeddedConfig.getHAudLists()).not.toBe(web3Config.getHAudLists());
      expect(embeddedConfig.getHAudLists1()).not.toBe(web3Config.getHAudLists1());
    });
  });
});
