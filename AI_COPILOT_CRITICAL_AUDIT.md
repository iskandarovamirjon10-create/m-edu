# M-EDU AI Copilot — Forensic Critical Thinking & Defect Audit

> **Audit Date:** 2026-11-13  
> **Auditors:** Principal AI Architect, Senior Security Engineer, Staff Frontend Engineer  
> **Subject:** `apps/api/src/ai` (Backend Gateway, Tool Orchestrator, Prompting) & `apps/web/src/components/ai` (Copilot UX, SSE Stream, Storage)

---

## Executive Summary

Ushbu audit **M-EDU AI Copilot** arxitekturasi, backend vositalar ijrosi (Tool Execution), oqimli uzatish (SSE), foydalanuvchi tajribasi (UX/UI) va xavfsizlik (RBAC, Prompt Injection, Token Exhaustion) bo‘yicha chuqur tahliliy ko‘rikdan o‘tkazildi.

Tizimda 108 ta API unit testlari va 62 ta Web unit testlari mavjud bo‘lib, asosiy rejalashtirish va tenant-izolyatsiya yaxshi yo‘lga qo‘yilgan. Shunga qaramay, haqiqiy ishlab chiqarish (production) sharoitida jiddiy muammolar, mantiqiy uzilishlar va xavflar aniqlandi.

---

## 1. Topilgan Asosiy Kamchiliklar va Xatolar (Flaws & Vulnerabilities)

### 🔴 1. SSE Stream uzilishida Client-Side Auto-Recovery yo‘qligi (UX & Resiliency Flaw)
- **Fayl:** `apps/web/src/lib/ai.ts` (`aiChatStream`) va `useAiCopilot.ts`
- **Muammo:** Serverdan SSE (`text/event-stream`) orqali javob kelayotgan vaqtda mikro-tarmoq uzilishi sodir bo‘lsa, stream to‘xtab qoladi (`reader.read()` xato tashlaydi). Ammo mijoz (frontend) qisman olingan chunklarni saqlab, `Last-Event-ID` yoki `offset` orqali qayta ulanish mexanizmiga ega emas. Natijada foydalanuvchi uzoq o‘ylangan javobning yarmini yo‘qotadi va qaytadan to‘liq so‘rov yuborishga majbur bo‘ladi.
- **Tavsiya:** SSE stream uzilganda 1 martalik avtomatik `resume` (oxirgi chunk pozitsiyasidan davom ettirish) yoki qisman javobni "Xabar uzildi — qayta urinish" tugmasi bilan birga ko‘rsatish.

---

### 🔴 2. Tool Multi-Round Loopda "Infinite Loop / Token Exhaustion" Xavfi (Backend Flaw)
- **Fayl:** `apps/api/src/ai/application/ai-gateway.service.ts` (`MAX_TOOL_ROUNDS = 4`)
- **Muammo:** Agar LLM model (masalan, Gemini) noma'lum yoki noto‘g‘ri parametrli tool chaqirsa, backend unga `{ error: 'Unknown tool' }` qaytaradi. Gemini keyingi roundda yana o‘sha yoki boshqa noto‘g‘ri toolni qayta chaqirishi mumkin. 4 ta ketma-ket round har doim to‘liq kontekstni modelga yuboradi va javob berish vaqtini 15-20 soniyagacha cho‘zib, foydalanuvchi kutishini oshiradi va qimmatli tokenlarni behuda sarflaydi.
- **Tavsiya:** Agar model ketma-ket 2 marta bir xil xatoli tool chaqirsa, roundni darhol to‘xtatish va to‘g‘ridan-to‘g‘ri modeldan tushunarli matnli tushuntirish so‘rash.

---

### 🟡 3. LocalStorage 5MB Limit va Attachment Memory Leak (Frontend Storage Flaw)
- **Fayl:** `apps/web/src/hooks/useAiCopilot.ts` (`persistConversation`)
- **Muammo:** `persistConversation` funksiyasi xabarlarni saqlashda rasmlarning `base64` qismini tozalaydi, ammo agar suhbatda 50+ ta katta jadvalli yoki markdown formatli xabarlar to‘plansa, brauzerning 5MB hajmli `localStorage`i to‘lib `QuotaExceededError` tashlaydi. Hozirda bu faqat `catch {}` orqali yashirilgan, ya'ni keyingi suhbatlar umuman saqlanmay qoladi va foydalanuvchiga hech qanday ogohlantirish berilmaydi.
- **Tavsiya:** `IndexedDB`ga o‘tish yoki faqat oxirgi 20 ta xabarni qoldirib, eski suhbatlarni xavfsiz arxivlash (FIFO eviction).

---

### 🟡 4. Write-Action Confirmation: Foydalanuvchi E'tiborsizligi (UX/UI Safety Flaw)
- **Fayl:** `apps/web/src/components/ai/AiActionConfirmation.tsx`
- **Muammo:** Xarajat kiritish (`finance.record_expense`), yangi o‘quvchi qo‘shish (`students.create`) yoki xabarnoma yuborish (`notifications.broadcast`) kabi xavfli amallarda modal faqat oddiy "Tasdiqlash" tugmasini ko‘rsatadi. 10 000 000 so‘mlik xarajat bilan 100 000 so‘mlik xarajat o‘rtasida vizual ogohlantirish (critical impact warning) darajasi bir xil.
- **Tavsiya:** Katta summali yoki o‘chirish/ommaviy xabarnoma amallarida Apple HIG uslubidagi **Red Critical Action Guard** (masalan, 3 soniyali countdown yoki qayta tekshirish matni) qo‘shish.

---

### 🟡 5. Uzbek NLP Intent Extraction: Dialekt va Kirill-Lotin chalkashligi (NLP Flaw)
- **Fayl:** `apps/api/src/ai/domain/uzbek-nlp.util.ts`
- **Muammo:** O‘quv markazlari xodimlari ko‘pincha aralash yozishadi: masalan, "Alisher Valiyev bugun keldimi?" o‘rniga "Алишер Валиев бугун келдими?" yoki "Alisherni qarzi qancha?". Hozirgi `extractUzbekEntityCandidates` regex qoidalari asosan sof lotin alifbosi va qat'iy qo‘shimchalarga (`-ning`, `-ga`, `-ni`) sozlangan. Noaniq so‘zlarda o‘quvchi ismini noto‘g‘ri ajratib oladi va qidiruvda bo‘sh natija qaytaradi.
- **Tavsiya:** Kirill-lotin avtomatik transliteratsiya pre-processorini kiritish va o‘zbekcha noaniq ismlarni qidirishda Levenshtein / Trigram qidiruvini kuchaytirish.

---

### 🟢 6. Markdown Parser: KateX Formula & Kod Sintaksisi Cheklovlari (UI Presentation Flaw)
- **Fayl:** `apps/web/src/components/ai/MarkdownContent.tsx`
- **Muammo:** Murakkab matematik formulalar yoki ko‘p ustunli moliyaviy jadvallarda matn gorizontal sig‘may mobil ekranda layoutni buzadi. Kod bloklarida esa "Nusxalash" tugmasi muvaffaqiyat holati (haptic + tick) juda tez yo‘qoladi.
- **Tavsiya:** Jadvallar uchun avtomatik `overflow-x-auto` shisha konteyner va KaTeX formulalar uchun mobil moslashuvchanlikni oshirish.

---

## 2. Amaliy Harakatlar Rejasi (Action Blueprint)

| № | Muammo | Prioritet | Mas'ul Qism | Holat |
|---|---|---|---|---|
| 1 | Stream avto-tiklanish va qisman yuklash xavfsizligi | HIGH | `apps/web/src/lib/ai.ts` | Loyihalandi |
| 2 | Tool roundlarida ketma-ket xatoliklarni cheklash (Guard) | HIGH | `apps/api/src/ai` | Loyihalandi |
| 3 | LocalStorage to‘lishidan himoya (FIFO / IndexedDB) | MEDIUM | `apps/web/src/hooks` | Loyihalandi |
| 4 | Xavfli moliyaviy harakatlarda Critical Confirmation Guard | MEDIUM | `AiActionConfirmation.tsx` | Loyihalandi |
| 5 | Kirill/Lotin ikki tilli O‘zbek NLP preprocessing | MEDIUM | `uzbek-nlp.util.ts` | Loyihalandi |

---
*Ushbu hisobot tizimning keyingi bosqichida AI Copilotni enterprise darajasiga olib chiqish uchun asosiy qo‘llanma bo‘lib xizmat qiladi.*
