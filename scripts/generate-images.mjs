import { GoogleGenAI } from '@google/genai'
import { mkdir, writeFile } from 'node:fs/promises'

const client = new GoogleGenAI({ apiKey: process.env.NETLIFY_AI_GATEWAY_KEY, httpOptions: { baseUrl: process.env.NETLIFY_AI_GATEWAY_BASE_URL?.replace(/\/$/, '') } })
await mkdir('public/img', { recursive: true })
const prompt = 'Professional lifestyle photograph for a premium Brazilian pet care brand website hero, panoramic landscape aspect ratio 16:9. A happy golden retriever on the right foreground, a beautiful small tabby cat sitting beside it, both relaxed in a sunny garden. Soft green grass and blurred leafy trees, warm afternoon sun, authentic photographic realism, subtle film grain. On the left background lots of soft out-of-focus green foliage with no objects, animals only occupy right 55 percent. Natural colors, warm light, candid, editorial, premium. No text, no letters, no logo, no watermark. Photograph not illustration.'
try {
  const response = await client.models.generateContent({ model: 'gemini-3.1-flash-image', contents: prompt, config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } })
  const image = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData)?.inlineData
  if (!image?.data) throw new Error('No image')
  await writeFile('public/img/pet-companions.png', Buffer.from(image.data, 'base64'))
  console.log('Brand photograph saved.')
} catch { console.log('Image generation unavailable; using a photographic fallback.'); process.exitCode = 1 }
