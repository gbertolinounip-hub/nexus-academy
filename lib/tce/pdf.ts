import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import {
  UNIP_TCE_TEMPLATE_FIELDS,
  UNIP_TCE_TEMPLATE_PATH,
  UNIP_TCE_TEMPLATE_VERSION,
  type UnipPdfRectSpec,
  type UnipPdfTextFieldSpec
} from "@/lib/tce/unip-template-map";
import type {
  TceConfigurationSnapshot,
  TceConcedingPartyData,
  TceScheduleData,
  TceStudentData
} from "@/types/domain";

interface TcePdfRenderInput {
  snapshot: TceConfigurationSnapshot;
  studentData: TceStudentData;
}

interface ResolvedTextFit {
  text: string;
  size: number;
}

const TEXT_COLOR = rgb(0.08, 0.08, 0.08);
const COVER_COLOR = rgb(1, 1, 1);
const MIN_FONT_SIZE = 7.2;
const TEMPLATE_SUPPORTED_VERSIONS = new Set([
  UNIP_TCE_TEMPLATE_VERSION,
  null,
  ""
]);
const PT_BR_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getOptionalText(value: string | null | undefined) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function parseDateParts(value: string | null | undefined) {
  const normalizedValue = getOptionalText(value);

  if (!normalizedValue) {
    return null;
  }

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { day, month, year };
    }
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    day: parsedDate.getUTCDate(),
    month: parsedDate.getUTCMonth() + 1,
    year: parsedDate.getUTCFullYear()
  };
}

function formatShortDate(value: string | null | undefined) {
  const parts = parseDateParts(value);

  if (!parts) {
    return getOptionalText(value);
  }

  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

function formatLongDate(value: string | null | undefined) {
  const parts = parseDateParts(value);

  if (!parts) {
    return getOptionalText(value);
  }

  return `${parts.day} de ${PT_BR_MONTHS[parts.month - 1]} de ${parts.year}`;
}

function splitPhone(value: string | null | undefined) {
  const digits = getOptionalText(value).replace(/\D+/g, "");

  if (!digits) {
    return {
      areaCode: "",
      number: ""
    };
  }

  if (digits.length <= 2) {
    return {
      areaCode: digits,
      number: ""
    };
  }

  return {
    areaCode: digits.slice(0, 2),
    number: digits.slice(2)
  };
}

function fitTextToWidth(input: {
  font: PDFFont;
  text: string;
  width: number;
  size: number;
  minSize?: number;
}) {
  const normalizedText = getOptionalText(input.text);

  if (!normalizedText) {
    return {
      text: "",
      size: input.size
    } satisfies ResolvedTextFit;
  }

  let fontSize = input.size;
  const minSize = input.minSize ?? MIN_FONT_SIZE;

  while (
    fontSize > minSize &&
    input.font.widthOfTextAtSize(normalizedText, fontSize) > input.width
  ) {
    fontSize = Number((fontSize - 0.2).toFixed(2));
  }

  if (input.font.widthOfTextAtSize(normalizedText, fontSize) <= input.width) {
    return {
      text: normalizedText,
      size: fontSize
    } satisfies ResolvedTextFit;
  }

  const ellipsis = "...";
  let truncatedText = normalizedText;

  while (truncatedText.length > 1) {
    truncatedText = truncatedText.slice(0, -1).trimEnd();
    const candidateText = `${truncatedText}${ellipsis}`;

    if (input.font.widthOfTextAtSize(candidateText, fontSize) <= input.width) {
      return {
        text: candidateText,
        size: fontSize
      } satisfies ResolvedTextFit;
    }
  }

  return {
    text: ellipsis,
    size: fontSize
  } satisfies ResolvedTextFit;
}

function wrapTextIntoLines(input: {
  font: PDFFont;
  text: string;
  width: number;
  size: number;
  maxLines: number;
}) {
  const normalizedText = getOptionalText(input.text);

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;

    if (input.font.widthOfTextAtSize(candidateLine, input.size) <= input.width) {
      currentLine = candidateLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (input.font.widthOfTextAtSize(word, input.size) <= input.width) {
      currentLine = word;
      continue;
    }

    let fragment = "";

    for (const character of word) {
      const candidateFragment = `${fragment}${character}`;

      if (input.font.widthOfTextAtSize(candidateFragment, input.size) <= input.width) {
        fragment = candidateFragment;
        continue;
      }

      if (fragment) {
        lines.push(fragment);
      }

      fragment = character;
    }

    currentLine = fragment;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= input.maxLines) {
    return lines;
  }

  const visibleLines = lines.slice(0, input.maxLines);
  const lastVisibleLine = visibleLines[input.maxLines - 1] ?? "";
  const truncatedLastLine = fitTextToWidth({
    font: input.font,
    text: `${lastVisibleLine}...`,
    width: input.width,
    size: input.size,
    minSize: input.size
  });

  visibleLines[input.maxLines - 1] = truncatedLastLine.text;
  return visibleLines;
}

function resolveFieldX(input: {
  font: PDFFont;
  spec: UnipPdfTextFieldSpec;
  text: string;
  size: number;
}) {
  const textWidth = input.font.widthOfTextAtSize(input.text, input.size);

  if (input.spec.align === "center") {
    return input.spec.x + Math.max((input.spec.width - textWidth) / 2, 0);
  }

  if (input.spec.align === "right") {
    return input.spec.x + Math.max(input.spec.width - textWidth, 0);
  }

  return input.spec.x;
}

function drawTextField(input: {
  page: PDFPage;
  font: PDFFont;
  spec: UnipPdfTextFieldSpec;
  value: string | null | undefined;
}) {
  const resolvedText = fitTextToWidth({
    font: input.font,
    text: getOptionalText(input.value),
    width: input.spec.width,
    size: input.spec.size,
    minSize: input.spec.minSize
  });

  if (!resolvedText.text) {
    return;
  }

  input.page.drawText(resolvedText.text, {
    x: resolveFieldX({
      font: input.font,
      spec: input.spec,
      text: resolvedText.text,
      size: resolvedText.size
    }),
    y: input.spec.y,
    font: input.font,
    size: resolvedText.size,
    color: TEXT_COLOR
  });
}

function drawActivityPlan(input: {
  pages: PDFPage[];
  font: PDFFont;
  activityPlan: string | null | undefined;
}) {
  const lineSpecs = UNIP_TCE_TEMPLATE_FIELDS.activityPlanLines;
  const normalizedText = getOptionalText(input.activityPlan);

  if (!normalizedText) {
    return;
  }

  const wrappedLines = wrapTextIntoLines({
    font: input.font,
    text: normalizedText,
    width: lineSpecs[0]?.width ?? 468,
    size: lineSpecs[0]?.size ?? 10.2,
    maxLines: lineSpecs.length
  });

  wrappedLines.forEach((line, index) => {
    const spec = lineSpecs[index];

    if (!spec) {
      return;
    }

    drawTextField({
      page: input.pages[spec.page],
      font: input.font,
      spec,
      value: line
    });
  });
}

function drawRect(input: {
  page: PDFPage;
  spec: UnipPdfRectSpec;
}) {
  input.page.drawRectangle({
    x: input.spec.x,
    y: input.spec.y,
    width: input.spec.width,
    height: input.spec.height,
    color: COVER_COLOR
  });
}

function buildSignatureDateLine(snapshot: TceConfigurationSnapshot) {
  const city = getOptionalText(snapshot.fixedData.signatureCity);
  const longDate = formatLongDate(snapshot.fixedData.signatureDate);

  if (!city && !longDate) {
    return "";
  }

  if (city && longDate) {
    return `${city}, ${longDate}.`;
  }

  return city || longDate;
}

function getTemplateVersion(snapshot: TceConfigurationSnapshot) {
  const resolvedVersion = getOptionalText(snapshot.model.templateVersion);
  return TEMPLATE_SUPPORTED_VERSIONS.has(resolvedVersion)
    ? UNIP_TCE_TEMPLATE_VERSION
    : UNIP_TCE_TEMPLATE_VERSION;
}

function fillConcedingParty(input: {
  pages: PDFPage[];
  font: PDFFont;
  data: TceConcedingPartyData;
}) {
  const fields = UNIP_TCE_TEMPLATE_FIELDS.concedingParty;
  const phone = splitPhone(input.data.phone);
  const internshipPhone = splitPhone(input.data.internshipLocationPhone);
  const page = input.pages[0];

  drawTextField({ page, font: input.font, spec: fields.corporateName, value: input.data.corporateName });
  drawTextField({ page, font: input.font, spec: fields.documentNumber, value: input.data.documentNumber });
  drawTextField({ page, font: input.font, spec: fields.address, value: input.data.address });
  drawTextField({ page, font: input.font, spec: fields.addressNumber, value: input.data.addressNumber });
  drawTextField({ page, font: input.font, spec: fields.addressComplement, value: input.data.addressComplement });
  drawTextField({ page, font: input.font, spec: fields.neighborhood, value: input.data.neighborhood });
  drawTextField({ page, font: input.font, spec: fields.city, value: input.data.city });
  drawTextField({ page, font: input.font, spec: fields.state, value: input.data.state });
  drawTextField({ page, font: input.font, spec: fields.postalCode, value: input.data.postalCode });
  drawTextField({ page, font: input.font, spec: fields.phoneAreaCode, value: phone.areaCode });
  drawTextField({ page, font: input.font, spec: fields.phoneNumber, value: phone.number });
  drawTextField({ page, font: input.font, spec: fields.email, value: input.data.email });
  drawTextField({ page, font: input.font, spec: fields.internshipLocation, value: input.data.internshipLocation });
  drawTextField({ page, font: input.font, spec: fields.internshipAddress, value: input.data.internshipLocationAddress });
  drawTextField({ page, font: input.font, spec: fields.internshipAddressNumber, value: input.data.internshipLocationNumber });
  drawTextField({ page, font: input.font, spec: fields.internshipAddressComplement, value: input.data.internshipLocationComplement });
  drawTextField({ page, font: input.font, spec: fields.internshipNeighborhood, value: input.data.internshipLocationNeighborhood });
  drawTextField({ page, font: input.font, spec: fields.internshipCity, value: input.data.internshipLocationCity });
  drawTextField({ page, font: input.font, spec: fields.internshipState, value: input.data.internshipLocationState });
  drawTextField({ page, font: input.font, spec: fields.internshipPostalCode, value: input.data.internshipLocationPostalCode });
  drawTextField({ page, font: input.font, spec: fields.internshipPhoneAreaCode, value: internshipPhone.areaCode });
  drawTextField({ page, font: input.font, spec: fields.internshipPhoneNumber, value: internshipPhone.number });
  drawTextField({ page, font: input.font, spec: fields.internshipEmail, value: input.data.internshipLocationEmail });
  drawTextField({ page, font: input.font, spec: fields.responsibleName, value: input.data.responsibleName });
  drawTextField({ page, font: input.font, spec: fields.responsibleDocument, value: input.data.responsibleDocument });
  drawTextField({ page, font: input.font, spec: fields.professionalCouncil, value: input.data.professionalCouncil });
}

function fillStudent(input: {
  pages: PDFPage[];
  font: PDFFont;
  data: TceStudentData;
}) {
  const fields = UNIP_TCE_TEMPLATE_FIELDS.student;
  const phone = splitPhone(input.data.phone);
  const page = input.pages[0];

  drawTextField({ page, font: input.font, spec: fields.fullName, value: input.data.fullName });
  drawTextField({ page, font: input.font, spec: fields.registration, value: input.data.registration });
  drawTextField({ page, font: input.font, spec: fields.campus, value: input.data.campus });
  drawTextField({ page, font: input.font, spec: fields.courseName, value: input.data.courseName });
  drawTextField({ page, font: input.font, spec: fields.semesterLabel, value: input.data.semesterLabel });
  drawTextField({ page, font: input.font, spec: fields.shift, value: input.data.shift });
  drawTextField({ page, font: input.font, spec: fields.address, value: input.data.address });
  drawTextField({ page, font: input.font, spec: fields.addressNumber, value: input.data.addressNumber });
  drawTextField({ page, font: input.font, spec: fields.addressComplement, value: input.data.addressComplement });
  drawTextField({ page, font: input.font, spec: fields.neighborhood, value: input.data.neighborhood });
  drawTextField({ page, font: input.font, spec: fields.city, value: input.data.city });
  drawTextField({ page, font: input.font, spec: fields.state, value: input.data.state });
  drawTextField({ page, font: input.font, spec: fields.postalCode, value: input.data.postalCode });
  drawTextField({ page, font: input.font, spec: fields.phoneAreaCode, value: phone.areaCode });
  drawTextField({ page, font: input.font, spec: fields.phoneNumber, value: phone.number });
  drawTextField({ page, font: input.font, spec: fields.email, value: input.data.email });
}

function fillTermAndSchedule(input: {
  pages: PDFPage[];
  font: PDFFont;
  termData: TceConfigurationSnapshot["fixedData"]["termData"];
  scheduleData: TceScheduleData;
  dailyWorkload: string | null;
  weeklyWorkload: string | null;
  semesterWorkload: string | null;
}) {
  const page = input.pages[1];
  const termFields = UNIP_TCE_TEMPLATE_FIELDS.term;
  const scheduleFields = UNIP_TCE_TEMPLATE_FIELDS.schedule;
  const workloadFields = UNIP_TCE_TEMPLATE_FIELDS.workload;

  drawTextField({
    page,
    font: input.font,
    spec: termFields.startsAt,
    value: formatShortDate(input.termData.startsAt)
  });
  drawTextField({
    page,
    font: input.font,
    spec: termFields.endsAt,
    value: formatShortDate(input.termData.endsAt)
  });

  const scheduleEntries = [
    [scheduleFields.monday, input.scheduleData.monday],
    [scheduleFields.tuesday, input.scheduleData.tuesday],
    [scheduleFields.wednesday, input.scheduleData.wednesday],
    [scheduleFields.thursday, input.scheduleData.thursday],
    [scheduleFields.friday, input.scheduleData.friday],
    [scheduleFields.saturday, input.scheduleData.saturday]
  ] as const;

  scheduleEntries.forEach(([specs, day]) => {
    drawTextField({ page, font: input.font, spec: specs.startTime, value: day?.startTime });
    drawTextField({ page, font: input.font, spec: specs.endTime, value: day?.endTime });
    drawTextField({
      page,
      font: input.font,
      spec: specs.breakStartTime,
      value: day?.breakStartTime
    });
    drawTextField({
      page,
      font: input.font,
      spec: specs.breakEndTime,
      value: day?.breakEndTime
    });
  });

  drawTextField({
    page,
    font: input.font,
    spec: workloadFields.daily,
    value: input.dailyWorkload
  });
  drawTextField({
    page,
    font: input.font,
    spec: workloadFields.weekly,
    value: input.weeklyWorkload || input.semesterWorkload
  });
}

export async function buildStudentTcePdfBuffer(input: TcePdfRenderInput) {
  const templateVersion = getTemplateVersion(input.snapshot);
  const templatePath =
    templateVersion === UNIP_TCE_TEMPLATE_VERSION
      ? path.join(process.cwd(), UNIP_TCE_TEMPLATE_PATH)
      : path.join(process.cwd(), UNIP_TCE_TEMPLATE_PATH);
  const templateBytes = await readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  pdfDoc.setTitle(
    `TCE - ${getOptionalText(input.snapshot.context.areaName) || "estagio"} - ${getOptionalText(input.snapshot.context.semesterCode) || "semestre"}`
  );
  pdfDoc.setSubject("Termo de Compromisso de Estagio");
  pdfDoc.setCreator("Nexus Academy");
  pdfDoc.setProducer("Nexus Academy");

  fillConcedingParty({
    pages,
    font,
    data: input.snapshot.fixedData.concedingPartyData
  });
  fillStudent({
    pages,
    font,
    data: input.studentData
  });
  fillTermAndSchedule({
    pages,
    font,
    termData: input.snapshot.fixedData.termData,
    scheduleData: input.snapshot.fixedData.scheduleData,
    dailyWorkload: input.snapshot.fixedData.dailyWorkload,
    weeklyWorkload: input.snapshot.fixedData.weeklyWorkload,
    semesterWorkload: input.snapshot.fixedData.semesterWorkload
  });
  drawActivityPlan({
    pages,
    font,
    activityPlan: input.snapshot.fixedData.activityPlan
  });

  const signatureText = buildSignatureDateLine(input.snapshot);

  if (signatureText) {
    drawRect({
      page: pages[UNIP_TCE_TEMPLATE_FIELDS.signatureLine.cover.page],
      spec: UNIP_TCE_TEMPLATE_FIELDS.signatureLine.cover
    });
    drawTextField({
      page: pages[UNIP_TCE_TEMPLATE_FIELDS.signatureLine.text.page],
      font,
      spec: UNIP_TCE_TEMPLATE_FIELDS.signatureLine.text,
      value: signatureText
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
