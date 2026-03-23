/**
 * Built-in provider config presets for ZKAP product lineups.
 *
 * Each preset contains OAuth client IDs (public values) and their
 * Poseidon-hashed equivalents (hAud) used by on-chain ZK verifiers.
 *
 * Third-party apps should use ZkapProviderConfig.custom() instead.
 */

import type { ZkapProviderConfigOptions } from "./ZkapProviderConfig";

export type ProviderPreset = "embedded-zkap" | "zkap-web3";

export const PRESETS: Record<ProviderPreset, ZkapProviderConfigOptions> = {
  "embedded-zkap": {
    providers: {
      GOOGLE: {
        clientId:
          "193471906673-7qsgcjjm7ms65gku0es13akd15fc15r7.apps.googleusercontent.com",
        hAud: "0xB36548DFFB9BA33344F937CAE294829F6B86FB3412D892B908124418C9D9A75",
      },
      KAKAO: {
        clientId: "d94809e9a1ea2e0a8d51647b585bf68d",
        hAud: "0x245EC8B02B6D98E1E3BBCF2C7DE1C4981A6CEFD0833B3ECE23172B5A479269CF",
      },
      APPLE: {
        clientId: "",
        hAud: "",
      },
    },
    hAudLists:
      "0x277A83B5EF082A0C9452787835D4094400E1F6F04EA9CCEB7F16B78F99C04CF3",
    hAudLists1:
      "0x22AAC2577766C0A38703725B5DD647D2F250BBE4B3BC53246CF3DD30BE3F9EEE",
  },
  "zkap-web3": {
    providers: {
      GOOGLE: {
        clientId:
          "339888083889-t0ql63jn1tgr5055hbeip18l3h7reo1l.apps.googleusercontent.com",
        hAud: "0x1E0CD002672F6BF5AD5EF6065D69785173E8BCC9931ECBD3B3959593C9ABB4F5",
      },
      KAKAO: {
        clientId: "f6bb9f1684b080e8c6e0263a9c59e665",
        hAud: "0x245EC8B02B6D98E1E3BBCF2C7DE1C4981A6CEFD0833B3ECE23172B5A479269CF",
      },
      APPLE: {
        clientId: "",
        hAud: "",
      },
    },
    hAudLists:
      "0x2EBCF1103ACFD688B01C1E6AEB143FBCFEA95F66D0B5DCED16F7EC94B8BBCB46",
    hAudLists1:
      "0x18DA9012F34A6AE59E92B05727C9C726FBFE3AC032690667E5DF223C539B7CB3",
  },
};
