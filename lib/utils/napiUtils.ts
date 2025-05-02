import vk_init from "../../vk_init.json";
import ffi from "ffi-napi";
import ref from "ref-napi";

const pointerSize = ref.sizeof.pointer;

function convertDecToHex(decStrings: string[]): string[] {
    return decStrings.map((dec) => {
        try {
            const bigIntVal = BigInt(dec);
            return "0x" + bigIntVal.toString(16);
        } catch (error) {
            throw new Error(`Invalid decimal string: ${dec}`);
        }
    });
}

function createCStringArray(strings: string[]): Buffer {
    const count = strings.length;
    // 포인터 크기(ref.sizeof.pointer) × 문자열 개수만큼의 메모리를 할당합니다.
    const buffer = Buffer.alloc(count * pointerSize);
    for (let i = 0; i < count; i++) {
        // 각 문자열을 null-terminated Buffer로 생성합니다.
        const strBuffer = Buffer.from(strings[i] + "\0", "utf8");
        // 생성한 Buffer의 포인터를 결과 Buffer의 적절한 위치에 씁니다.
        buffer.writePointer(strBuffer, i * pointerSize);
    }
    return buffer;
}

const hexStrings = convertDecToHex(vk_init);

const napiUtils = {
    convertDecToHex,
    createCStringArray,
};

export { napiUtils };
