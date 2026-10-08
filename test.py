import json
import mimetypes
import os
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.exit(
        "ยังไม่ได้ติดตั้งไลบรารี กรุณารันคำสั่ง:\n"
        "pip install -U google-genai"
    )


PROMPT = (
    "อ่านฉลากยาในรูปนี้ แล้วตอบเป็น JSON เท่านั้น "
    "ห้ามมีคำอธิบายอื่นปนมา\n"
    "\n"
    "รูปแบบ JSON ที่ต้องการ:\n"
    "{\n"
    '  "medicine_name": string หรือ null,\n'
    '  "dosage": string หรือ null,\n'
    '  "times": [string] หรือ [],\n'
    '  "note": string หรือ null\n'
    "}\n"
    "\n"
    "คำแนะนำในการอ่านข้อมูล:\n"
    "- medicine_name: ชื่อยา อ่านตามที่เห็นในรูป\n"
    "- dosage: ขนาดหรือปริมาณยาต่อครั้ง ตามที่เห็นในรูป\n"
    "- times: เวลา หรือช่วงเวลาที่ให้รับประทาน เช่น "
    '"เช้า", "ก่อนนอน", "หลังอาหาร"\n'
    '- หากฉลากระบุว่าให้รับประทานเมื่อมีอาการ ให้ใส่ใน note ว่า '
    '"รับประทานเมื่อมีอาการ" อย่างชัดเจน\n'
    '- หากฉลากระบุจำนวนครั้งหรือเงื่อนไขเพิ่มเติม ให้ใส่รายละเอียดนั้นต่อท้ายใน note\n'
    '- หากไม่พบข้อมูลการรับประทานเมื่อมีอาการ ให้ใส่ note เป็น null\n'
    "- ถ้าอ่านจุดไหนไม่ชัดหรือไม่มั่นใจ ให้ใส่ null ในฟิลด์นั้น "
    "ห้ามเดาข้อมูลที่ไม่มีหลักฐานอยู่ในรูป\n"
    "- ตอบเป็น JSON ที่ถูกต้องเท่านั้น ห้ามใส่ Markdown หรือเครื่องหมาย ```"
)




def guess_mime_type(path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(path.name)

    if mime_type and mime_type.startswith("image/"):
        return mime_type

    return "image/jpeg"


def main():
    if len(sys.argv) != 2:
        sys.exit("วิธีใช้: python test.py ไฟล์รูป.jpg")

    image_path = Path(sys.argv[1])

    if not image_path.is_file():
        sys.exit(f"ไม่พบไฟล์: {image_path}")

    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        sys.exit("ยังไม่ได้ตั้งค่า GEMINI_API_KEY")

    image_bytes = image_path.read_bytes()
    mime_type = guess_mime_type(image_path)

    # ต้องสร้าง client ก่อนเรียก client.models.generate_content()
    client = genai.Client(api_key=api_key)

    print(f"กำลังสแกน: {image_path.name} ...\n")

    response = None
    max_retries = 3

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[
                    PROMPT,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

            # เรียกสำเร็จ ออกจากลูป
            break

        except Exception as error:
            if attempt == 2:
              sys.exit(f"เรียก Gemini ไม่สำเร็จ:\n{error}")


            wait_seconds = 2 ** attempt * 10

            print(
                "เซิร์ฟเวอร์ไม่พร้อมใช้งาน "
                f"กำลังลองใหม่ใน {wait_seconds} วินาที..."
            )

    if response is None:
        sys.exit("Gemini ไม่ส่งผลลัพธ์กลับมา")

    response_text = response.text or ""

    if not response_text.strip():
        print("Gemini ส่งคำตอบว่างกลับมา")
        print("ลองใช้รูปที่ชัดขึ้นหรือรันใหม่อีกครั้ง")
        return

    try:
        result = json.loads(response_text)

        result["warning"] = (
            "รับประทานยาเมื่อมีอาการเท่านั้น "
            "ควรตรวจสอบกับฉลากจริงหรือเภสัชกรก่อนใช้ยา "
            "หากมีอาการแพ้หรืออาการผิดปกติ ให้หยุดใช้ยาและพบแพทย์"
        )

        print(json.dumps(result, ensure_ascii=False, indent=2))

    except json.JSONDecodeError:
        print("Gemini ตอบกลับมาไม่เป็น JSON ผลดิบคือ:")
        print(response_text)


           



if __name__ == "__main__":
    main()
