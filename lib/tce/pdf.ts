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

interface ParsedDateParts {
  day: string;
  month: string;
  year: string;
}

const TEXT_COLOR = rgb(0.08, 0.08, 0.08);
const COVER_COLOR = rgb(1, 1, 1);
const LINE_COLOR = rgb(0.18, 0.18, 0.18);
const MIN_FONT_SIZE = 6.6;
const TEMPLATE_SUPPORTED_VERSIONS = new Set([
  UNIP_TCE_TEMPLATE_VERSION,
  null,
  ""
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getOptionalText(value: string | null | undefined) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function parseDateParts(value: string | null | undefined): ParsedDateParts | null {
  const normalizedValue = getOptionalText(value);

  if (!normalizedValue) {
    return null;
  }

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return {
      day: isoMatch[3],
      month: isoMatch[2],
      year: isoMatch[1]
    };
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    day: String(parsedDate.getUTCDate()).padStart(2, "0"),
    month: String(parsedDate.getUTCMonth() + 1).padStart(2, "0"),
    year: String(parsedDate.getUTCFullYear())
  };
}

function formatLongDate(value: string | null | undefined) {
  const parts = parseDateParts(value);

  if (!parts) {
    return getOptionalText(value);
  }

  const asDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(asDate);
}

function buildTermDateRangeText(termData: TceConfigurationSnapshot["fixedData"]["termData"]) {
  const startsAt = parseDateParts(termData.startsAt);
  const endsAt = parseDateParts(termData.endsAt);

  if (startsAt && endsAt) {
    return `${startsAt.day} / ${startsAt.month} / ${startsAt.year} à ${endsAt.day} / ${endsAt.month} / ${endsAt.year}`;
  }

  if (startsAt) {
    return `${startsAt.day} / ${startsAt.month} / ${startsAt.year}`;
  }

  if (endsAt) {
    return `${endsAt.day} / ${endsAt.month} / ${endsAt.year}`;
  }

  return "";
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

function formatWorkloadHours(value: string | null | undefined) {
  const normalizedValue = getOptionalText(value);

  if (!normalizedValue) {
    return "";
  }

  if (/h\b/i.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^\d+([.,]\d+)?$/.test(normalizedValue)) {
    return `${normalizedValue}h`;
  }

  return normalizedValue;
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

  return {
    text: normalizedText,
    size: fontSize
  } satisfies ResolvedTextFit;
}

function wrapTextIntoLines(input: {
  font: PDFFont;
  text: string;
  width: number;
  size: number;
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

  return lines;
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

function drawActivityPlanLine(input: {
  page: PDFPage;
  font: PDFFont;
  x: number;
  y: number;
  width: number;
  size: number;
  value: string;
}) {
  const resolvedText = fitTextToWidth({
    font: input.font,
    text: input.value,
    width: input.width,
    size: input.size
  });

  if (!resolvedText.text) {
    return;
  }

  input.page.drawText(resolvedText.text, {
    x: input.x,
    y: input.y,
    font: input.font,
    size: resolvedText.size,
    color: TEXT_COLOR
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

  drawTextField({
    page,
    font: input.font,
    spec: fields.corporateName,
    value: input.data.corporateName
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.documentNumber,
    value: input.data.documentNumber
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.address,
    value: input.data.address
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.addressNumber,
    value: input.data.addressNumber
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.addressComplement,
    value: input.data.addressComplement
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.neighborhood,
    value: input.data.neighborhood
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.city,
    value: input.data.city
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.state,
    value: input.data.state
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.postalCode,
    value: input.data.postalCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.phoneAreaCode,
    value: phone.areaCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.phoneNumber,
    value: phone.number
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.email,
    value: input.data.email
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipLocation,
    value: input.data.internshipLocation
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipAddress,
    value: input.data.internshipLocationAddress
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipAddressNumber,
    value: input.data.internshipLocationNumber
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipAddressComplement,
    value: input.data.internshipLocationComplement
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipNeighborhood,
    value: input.data.internshipLocationNeighborhood
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipCity,
    value: input.data.internshipLocationCity
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipState,
    value: input.data.internshipLocationState
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipPostalCode,
    value: input.data.internshipLocationPostalCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipPhoneAreaCode,
    value: internshipPhone.areaCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipPhoneNumber,
    value: internshipPhone.number
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.internshipEmail,
    value: input.data.internshipLocationEmail
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.responsibleName,
    value: input.data.responsibleName
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.responsibleDocument,
    value: input.data.responsibleDocument
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.professionalCouncil,
    value: input.data.professionalCouncil
  });
}

function fillStudent(input: {
  pages: PDFPage[];
  font: PDFFont;
  data: TceStudentData;
}) {
  const fields = UNIP_TCE_TEMPLATE_FIELDS.student;
  const phone = splitPhone(input.data.phone);
  const page = input.pages[0];

  drawTextField({
    page,
    font: input.font,
    spec: fields.fullName,
    value: input.data.fullName
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.registration,
    value: input.data.registration
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.campus,
    value: input.data.campus
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.courseName,
    value: input.data.courseName
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.semesterLabel,
    value: input.data.semesterLabel
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.shift,
    value: input.data.shift
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.address,
    value: input.data.address
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.addressNumber,
    value: input.data.addressNumber
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.addressComplement,
    value: input.data.addressComplement
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.neighborhood,
    value: input.data.neighborhood
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.city,
    value: input.data.city
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.state,
    value: input.data.state
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.postalCode,
    value: input.data.postalCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.phoneAreaCode,
    value: phone.areaCode
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.phoneNumber,
    value: phone.number
  });
  drawTextField({
    page,
    font: input.font,
    spec: fields.email,
    value: input.data.email
  });
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
  const termDateRange = buildTermDateRangeText(input.termData);

  if (termDateRange) {
    drawRect({
      page,
      spec: termFields.rangeCover
    });
    drawTextField({
      page,
      font: input.font,
      spec: termFields.rangeText,
      value: termDateRange
    });
  }

  const scheduleEntries = [
    [scheduleFields.monday, input.scheduleData.monday],
    [scheduleFields.tuesday, input.scheduleData.tuesday],
    [scheduleFields.wednesday, input.scheduleData.wednesday],
    [scheduleFields.thursday, input.scheduleData.thursday],
    [scheduleFields.friday, input.scheduleData.friday],
    [scheduleFields.saturday, input.scheduleData.saturday]
  ] as const;

  scheduleEntries.forEach(([specs, day]) => {
    drawTextField({
      page,
      font: input.font,
      spec: specs.startTime,
      value: day?.startTime
    });
    drawTextField({
      page,
      font: input.font,
      spec: specs.endTime,
      value: day?.endTime
    });
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
    value: formatWorkloadHours(input.dailyWorkload)
  });
  drawTextField({
    page,
    font: input.font,
    spec: workloadFields.weekly,
    value: formatWorkloadHours(input.weeklyWorkload || input.semesterWorkload)
  });
}

function buildActivityPlanLines(font: PDFFont, activityPlan: string | null | undefined) {
  return wrapTextIntoLines({
    font,
    text: activityPlan ?? "",
    width: UNIP_TCE_TEMPLATE_FIELDS.activityPlanLines[0]?.width ?? 468,
    size: UNIP_TCE_TEMPLATE_FIELDS.activityPlanLines[0]?.size ?? 10.2
  });
}

async function insertContinuationActivityPages(input: {
  outputDoc: PDFDocument;
  templateDoc: PDFDocument;
  lines: string[];
  font: PDFFont;
}) {
  if (!input.lines.length) {
    return 0;
  }

  const continuationSpec = UNIP_TCE_TEMPLATE_FIELDS.activityPlanContinuationPage;
  const lineFontSize = UNIP_TCE_TEMPLATE_FIELDS.activityPlanLines[0]?.size ?? 10.2;
  const insertIndexBase = 3;
  const chunks: string[][] = [];

  for (let index = 0; index < input.lines.length; index += continuationSpec.linesPerPage) {
    chunks.push(input.lines.slice(index, index + continuationSpec.linesPerPage));
  }

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const [copiedPage] = await input.outputDoc.copyPages(input.templateDoc, [3]);
    const insertedPage = input.outputDoc.insertPage(
      insertIndexBase + chunkIndex,
      copiedPage
    );

    insertedPage.drawRectangle({
      x: continuationSpec.clearBody.x,
      y: continuationSpec.clearBody.y,
      width: continuationSpec.clearBody.width,
      height: continuationSpec.clearBody.height,
      color: COVER_COLOR
    });

    drawTextField({
      page: insertedPage,
      font: input.font,
      spec: continuationSpec.title,
      value: "PLANO DE ATIVIDADES DE ESTAGIO"
    });
    drawTextField({
      page: insertedPage,
      font: input.font,
      spec: continuationSpec.subtitle,
      value: "Continuacao"
    });

    chunk.forEach((line, lineIndex) => {
      const y = continuationSpec.firstLineY - lineIndex * continuationSpec.lineSpacing;

      drawActivityPlanLine({
        page: insertedPage,
        font: input.font,
        x: continuationSpec.lineX,
        y,
        width: continuationSpec.lineWidth,
        size: lineFontSize,
        value: line
      });

      insertedPage.drawLine({
        start: {
          x: continuationSpec.lineX,
          y: y - continuationSpec.lineStrokeOffset
        },
        end: {
          x: continuationSpec.lineX + continuationSpec.lineWidth,
          y: y - continuationSpec.lineStrokeOffset
        },
        thickness: 0.85,
        color: LINE_COLOR
      });
    });
  }

  return chunks.length;
}

async function drawActivityPlan(input: {
  outputDoc: PDFDocument;
  templateDoc: PDFDocument;
  font: PDFFont;
  activityPlan: string | null | undefined;
}) {
  const allLines = buildActivityPlanLines(input.font, input.activityPlan);

  if (!allLines.length) {
    return;
  }

  const officialSpecs = UNIP_TCE_TEMPLATE_FIELDS.activityPlanLines;
  const officialPageThreeSpecs = officialSpecs.slice(0, 6);
  const officialPageFourSpecs = officialSpecs.slice(6);
  const initialLines = allLines.slice(0, officialPageThreeSpecs.length);
  const pagesBeforeInsert = input.outputDoc.getPages();

  initialLines.forEach((line, index) => {
    const spec = officialPageThreeSpecs[index];

    if (!spec) {
      return;
    }

    drawActivityPlanLine({
      page: pagesBeforeInsert[spec.page],
      font: input.font,
      x: spec.x,
      y: spec.y,
      width: spec.width,
      size: spec.size,
      value: line
    });
  });

  if (allLines.length <= officialPageThreeSpecs.length) {
    return;
  }

  let linesForFinalPage = allLines.slice(officialPageThreeSpecs.length);
  let insertedPageCount = 0;

  if (allLines.length > officialSpecs.length) {
    const reservedFinalPageCount = officialPageFourSpecs.length;
    const middleLines = allLines.slice(
      officialPageThreeSpecs.length,
      allLines.length - reservedFinalPageCount
    );

    insertedPageCount = await insertContinuationActivityPages({
      outputDoc: input.outputDoc,
      templateDoc: input.templateDoc,
      lines: middleLines,
      font: input.font
    });
    linesForFinalPage = allLines.slice(-reservedFinalPageCount);
  }

  const pagesAfterInsert = input.outputDoc.getPages();
  const finalPlanPage = pagesAfterInsert[3 + insertedPageCount];

  linesForFinalPage.forEach((line, index) => {
    const spec = officialPageFourSpecs[index];

    if (!spec) {
      return;
    }

    drawActivityPlanLine({
      page: finalPlanPage,
      font: input.font,
      x: spec.x,
      y: spec.y,
      width: spec.width,
      size: spec.size,
      value: line
    });
  });
}

function applyAdjustedPageNumbers(pdfDoc: PDFDocument, font: PDFFont) {
  const pages = pdfDoc.getPages();

  if (pages.length <= 4) {
    return;
  }

  const pageNumberSpec = UNIP_TCE_TEMPLATE_FIELDS.pageNumber;

  pages.slice(3).forEach((page, index) => {
    page.drawRectangle({
      x: pageNumberSpec.cover.x,
      y: pageNumberSpec.cover.y,
      width: pageNumberSpec.cover.width,
      height: pageNumberSpec.cover.height,
      color: COVER_COLOR
    });

    drawTextField({
      page,
      font,
      spec: pageNumberSpec.text,
      value: String(index + 4)
    });
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
  const templateDoc = await PDFDocument.load(templateBytes);
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
  await drawActivityPlan({
    outputDoc: pdfDoc,
    templateDoc,
    font,
    activityPlan: input.snapshot.fixedData.activityPlan
  });

  const signatureText = buildSignatureDateLine(input.snapshot);
  const pagesAfterPlan = pdfDoc.getPages();
  const finalPage = pagesAfterPlan[pagesAfterPlan.length - 1];

  if (signatureText) {
    drawRect({
      page: finalPage,
      spec: {
        ...UNIP_TCE_TEMPLATE_FIELDS.signatureLine.cover,
        page: pagesAfterPlan.length - 1
      }
    });
    drawTextField({
      page: finalPage,
      font,
      spec: {
        ...UNIP_TCE_TEMPLATE_FIELDS.signatureLine.text,
        page: pagesAfterPlan.length - 1
      },
      value: signatureText
    });
  }

  applyAdjustedPageNumbers(pdfDoc, font);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
