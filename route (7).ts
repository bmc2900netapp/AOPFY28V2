export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import mammoth from 'mammoth';

const LLM_URL = 'https://netapp-stage.abacus.ai/v1/chat/completions';

// ---------------------------------------------------------------------------
// Extraction schema, expressed in the prompt. The model returns app-style
// camelCase keys so the Save action can POST straight to /api/submissions.
// Any field without a clear spoken answer MUST be the string 'NEEDS FOLLOW-UP'.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are an analyst for NetApp's OCIO FY28 Annual Operating Plan (AOP). You read a transcript of an interview between an IT owner and their SVP (and facilitator) and extract the proposed IT initiatives into structured draft records.

RULES (follow exactly):
1. SEGMENT the transcript into separate initiatives. The facilitator usually cues each one with "Initiative <number>: <title>". If no such cue exists, treat the whole transcript as ONE initiative and set "segmentationUncertain": true on it.
2. For every field, use ONLY what is actually stated in the transcript. NEVER invent values, dates, dollar amounts, names, or choices. If a field has no clear spoken answer, set it to the exact string "NEEDS FOLLOW-UP".
3. Money fields are plain numbers (no $ or commas). If a cost is explicitly stated as none/zero, use 0. If not discussed at all, use "NEEDS FOLLOW-UP".
4. totalFundingRequested = outsideServices + softwareCosts + hardwareCost when those are known numbers; otherwise "NEEDS FOLLOW-UP".
5. Dates must be ISO (YYYY-MM-DD) only when an explicit date is stated; otherwise "NEEDS FOLLOW-UP".
6. Choice fields must use one of the allowed choices exactly, or "NEEDS FOLLOW-UP".
7. Do NOT output any reasoning, thinking, or scratchpad. Return ONLY the JSON object described below.

ALLOWED CHOICES:
- initiativeType: "New" | "Carryover" | "ESTC"
- projectClassification: "Discretionary" | "Non-Discretionary"
- category: "Discretionary: Carry Over" | "Discretionary: Nice to Have" | "ESTC Prioritized" | "KBR & KTLO: Must Do" | "Top Strategic"
- edaDependency: "None" | "GTM" | "CSO" | "MDM" | "Finance" | "Enterprise" | "HR" | "Ops"
- itFunded: "Yes" | "No" | "Both"
- bizFunded: "Yes" | "No"
- architectureChanges: true | false (boolean; use "NEEDS FOLLOW-UP" if unclear)

PER-INITIATIVE FIELDS (app keys) to populate inside "fields":
projectTitle, projectNarrative, initiativeType, itProductOwner, estcMember, functionalOwner, functionalArea, projectClassification, category, complianceJustification, architectureChanges, edaDependency, edaProductManager, projectStartDate, projectEndDate, incrementalFtes, location, jobLevel, outsideServices, softwareCosts, hardwareCost, totalFundingRequested, incrementalLaborCosts, itFunded, itFundingAmount, bizFunded, bizFundingAmount, businessValueDetails, costSavings, revenueIncrease, otherComments

OUTPUT a single JSON object with this exact shape:
{
  "summary": "3-6 sentence executive summary of the whole conversation and what was proposed",
  "nextSteps": ["concrete next step or follow-up action identified in the conversation", ...],
  "initiatives": [
    {
      "title": "short initiative title",
      "status": "COMPLETE" or "NEEDS FOLLOW-UP",
      "summary": "1-3 sentence summary of this specific initiative",
      "segmentationUncertain": false,
      "fields": { ...app keys above... },
      "followUps": ["field or question needing a follow-up answer", ...],
      "confidenceNotes": ["any low-confidence extraction worth human review", ...]
    }
  ]
}
status is "COMPLETE" only when every required field (projectTitle, projectNarrative, initiativeType, itProductOwner, estcMember, functionalOwner, functionalArea, projectClassification, category, architectureChanges, edaDependency, projectStartDate, projectEndDate, incrementalFtes, outsideServices, softwareCosts, hardwareCost, totalFundingRequested, itFunded, bizFunded, businessValueDetails) has a real value; otherwise "NEEDS FOLLOW-UP".`;

async function extractText(request: Request): Promise<{ text: string; pdfDataUri?: string; filename?: string }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    return { text: String(body?.text ?? '') };
  }

  // multipart/form-data with a file
  const form = await request.formData();
  const pasted = form.get('text');
  if (typeof pasted === 'string' && pasted.trim()) {
    return { text: pasted };
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return { text: '' };
  }
  const blob = file as unknown as File;
  const name = (blob.name ?? '').toLowerCase();
  const buf = Buffer.from(await blob.arrayBuffer());

  if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value ?? '', filename: blob.name };
  }
  if (name.endsWith('.pdf')) {
    const b64 = buf.toString('base64');
    return { text: '', pdfDataUri: `data:application/pdf;base64,${b64}`, filename: blob.name };
  }
  // txt, vtt, srt, md, csv and anything else readable as text
  return { text: buf.toString('utf-8'), filename: blob.name };
}

function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return trimmed;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = request.headers.get('x-abacus-user-api-key') ?? process.env.ABACUSAI_API_KEY ?? '';
    if (!apiKey) {
      return NextResponse.json({ error: 'LLM service is not configured.' }, { status: 500 });
    }

    const { text, pdfDataUri, filename } = await extractText(request);
    if (!text.trim() && !pdfDataUri) {
      return NextResponse.json({ error: 'No transcript content was provided. Paste text or upload a .txt, .vtt, .docx, or .pdf file.' }, { status: 400 });
    }

    // Build the user message. For PDFs we attach the file; otherwise plain text.
    const userContent: any = pdfDataUri
      ? [
          { type: 'text', text: 'Extract the FY28 AOP initiatives from the attached transcript file. Return ONLY the JSON object.' },
          { type: 'file', file: { filename: filename ?? 'transcript.pdf', file_data: pdfDataUri } },
        ]
      : `Extract the FY28 AOP initiatives from the following transcript. Return ONLY the JSON object.\n\n--- TRANSCRIPT START ---\n${text}\n--- TRANSCRIPT END ---`;

    const payload = {
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8000,
    };

    const res = await fetch(LLM_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('LLM parse failed:', res.status, errText.slice(0, 500));
      return NextResponse.json({ error: `The parser could not process this transcript (status ${res.status}). Please try again.` }, { status: 502 });
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(stripCodeFences(content));
    } catch {
      console.error('LLM returned non-JSON:', String(content).slice(0, 500));
      return NextResponse.json({ error: 'The parser returned an unexpected format. Please try again.' }, { status: 502 });
    }

    const result = {
      summary: typeof parsed?.summary === 'string' ? parsed.summary : '',
      nextSteps: Array.isArray(parsed?.nextSteps) ? parsed.nextSteps.filter((x: any) => typeof x === 'string') : [],
      initiatives: Array.isArray(parsed?.initiatives) ? parsed.initiatives : [],
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Transcript parse error:', err);
    return NextResponse.json({ error: err?.message ?? 'Transcript parsing failed.' }, { status: 500 });
  }
}
