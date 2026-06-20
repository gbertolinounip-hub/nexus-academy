import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import type {
  TceConfigurationSnapshot,
  TceConcedingPartyData,
  TceScheduleData,
  TceStudentData
} from "@/types/domain";

const A4_PAGE_WIDTH = 595.28;
const A4_PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 42;
const PAGE_MARGIN_TOP = 48;
const PAGE_MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = A4_PAGE_WIDTH - PAGE_MARGIN_X * 2;
const TITLE_COLOR = rgb(0.12, 0.18, 0.32);
const MUTED_COLOR = rgb(0.35, 0.39, 0.48);
const BORDER_COLOR = rgb(0.8, 0.83, 0.88);
const HEADER_FILL = rgb(0.95, 0.97, 1);
const CELL_FILL = rgb(0.985, 0.99, 1);
const BODY_FONT_SIZE = 10;
const SMALL_FONT_SIZE = 8.5;
const LABEL_FONT_SIZE = 8.5;
const SECTION_TITLE_SIZE = 11;
const LINE_HEIGHT = 13;

interface TcePdfRenderInput {
  snapshot: TceConfigurationSnapshot;
  studentData: TceStudentData;
}

interface WrappedCell {
  label: string;
  lines: string[];
  wide?: boolean;
}

interface PdfLayoutState {
  pdfDoc: PDFDocument;
  regularFont: PDFFont;
  boldFont: PDFFont;
  page: PDFPage;
  y: number;
  pageNumber: number;
}

const TCE_CLAUSES = [
  "1. O estágio será desenvolvido no campo informado pela Parte Concedente, durante a vigência indicada neste termo, em conformidade com o plano de atividades e com a jornada aqui registrada.",
  "2. O estagiário compromete-se a cumprir a programação definida, respeitar as normas da instituição concedente e manter postura ética, sigilo profissional e responsabilidade técnica durante todo o período de estágio.",
  "3. A Parte Concedente acompanhará a rotina prática do estágio, assegurando condições adequadas para aprendizagem, supervisão local e registro das atividades compatíveis com a formação acadêmica do aluno.",
  "4. A Instituição de Ensino acompanhará o desenvolvimento acadêmico do estágio, mantendo o vínculo pedagógico com o aluno e podendo revisar as informações deste termo sempre que necessário.",
  "5. Quaisquer ajustes de vigência, jornada, campo de estágio ou plano de atividades deverão ser formalizados em nova versão deste documento antes da continuidade do estágio.",
  "6. O presente termo deve ser impresso e assinado fisicamente pela Parte Concedente, pelo Estagiário(a) e pela Instituição de Ensino para produzir os efeitos administrativos esperados."
];

function formatDatePtBr(value: string | null | undefined) {
  if (!value) {
    return "Não informado";
  }

  const normalizedDate = new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(normalizedDate);
}

function displayText(value: string | null | undefined, fallback = "Não informado") {
  return typeof value === "string" && value.trim().length ? value.trim() : fallback;
}

function joinTextParts(values: Array<string | null | undefined>, fallback = "Não informado") {
  const normalizedParts = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return normalizedParts.length ? normalizedParts.join(" - ") : fallback;
}

function formatScheduleRange(input: {
  startTime?: string | null;
  endTime?: string | null;
}) {
  if (!input.startTime || !input.endTime) {
    return "Não informado";
  }

  return `${input.startTime} às ${input.endTime}`;
}

function formatScheduleBreak(input: {
  breakStartTime?: string | null;
  breakEndTime?: string | null;
}) {
  if (!input.breakStartTime || !input.breakEndTime) {
    return "Sem intervalo";
  }

  return `${input.breakStartTime} às ${input.breakEndTime}`;
}

function normalizePdfText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(
  font: PDFFont,
  fontSize: number,
  text: string,
  maxWidth: number
) {
  const normalizedText = normalizePdfText(text);

  if (!normalizedText) {
    return ["-"];
  }

  const words = normalizedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidateLine, fontSize) <= maxWidth) {
      currentLine = candidateLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      currentLine = word;
      continue;
    }

    let fragment = "";

    for (const character of word) {
      const candidateFragment = `${fragment}${character}`;

      if (font.widthOfTextAtSize(candidateFragment, fontSize) <= maxWidth) {
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

  return lines.length ? lines : ["-"];
}

function addPage(state: PdfLayoutState) {
  state.page = state.pdfDoc.addPage([A4_PAGE_WIDTH, A4_PAGE_HEIGHT]);
  state.y = A4_PAGE_HEIGHT - PAGE_MARGIN_TOP;
  state.pageNumber += 1;
}

function ensureSpace(state: PdfLayoutState, requiredHeight: number) {
  if (state.y - requiredHeight < PAGE_MARGIN_BOTTOM) {
    addPage(state);
  }
}

function drawWrappedLines(input: {
  state: PdfLayoutState;
  lines: string[];
  x: number;
  y: number;
  font: PDFFont;
  fontSize: number;
  color?: ReturnType<typeof rgb>;
  lineHeight?: number;
}) {
  const lineHeight = input.lineHeight ?? LINE_HEIGHT;

  input.lines.forEach((line, index) => {
    input.state.page.drawText(line, {
      x: input.x,
      y: input.y - lineHeight * index,
      font: input.font,
      size: input.fontSize,
      color: input.color ?? rgb(0.1, 0.13, 0.18)
    });
  });
}

function drawSectionTitle(state: PdfLayoutState, title: string) {
  ensureSpace(state, 28);

  const boxHeight = 20;
  const topY = state.y;

  state.page.drawRectangle({
    x: PAGE_MARGIN_X,
    y: topY - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: HEADER_FILL,
    borderColor: BORDER_COLOR,
    borderWidth: 0.75
  });
  state.page.drawText(title, {
    x: PAGE_MARGIN_X + 10,
    y: topY - 14,
    font: state.boldFont,
    size: SECTION_TITLE_SIZE,
    color: TITLE_COLOR
  });
  state.y = topY - boxHeight - 12;
}

function drawFieldRows(
  state: PdfLayoutState,
  fields: Array<{ label: string; value: string; wide?: boolean }>
) {
  const gap = 12;
  const narrowWidth = (CONTENT_WIDTH - gap) / 2;

  function flushRow(rowFields: WrappedCell[]) {
    if (!rowFields.length) {
      return;
    }

    const rowHeight =
      Math.max(
        ...rowFields.map(
          (field) => 12 + field.lines.length * LINE_HEIGHT + 12
        )
      ) + 4;

    ensureSpace(state, rowHeight);

    rowFields.forEach((field, index) => {
      const width = field.wide ? CONTENT_WIDTH : narrowWidth;
      const x = field.wide
        ? PAGE_MARGIN_X
        : PAGE_MARGIN_X + index * (narrowWidth + gap);
      const topY = state.y;

      state.page.drawRectangle({
        x,
        y: topY - rowHeight,
        width,
        height: rowHeight,
        color: CELL_FILL,
        borderColor: BORDER_COLOR,
        borderWidth: 0.75
      });

      state.page.drawText(field.label, {
        x: x + 8,
        y: topY - 14,
        font: state.boldFont,
        size: LABEL_FONT_SIZE,
        color: MUTED_COLOR
      });

      drawWrappedLines({
        state,
        lines: field.lines,
        x: x + 8,
        y: topY - 28,
        font: state.regularFont,
        fontSize: BODY_FONT_SIZE,
        lineHeight: LINE_HEIGHT
      });
    });

    state.y -= rowHeight + 10;
  }

  let currentRow: WrappedCell[] = [];

  fields.forEach((field) => {
    const cellWidth = field.wide ? CONTENT_WIDTH : narrowWidth;
    const lines = wrapText(
      state.regularFont,
      BODY_FONT_SIZE,
      field.value,
      cellWidth - 16
    );
    const wrappedField = {
      label: field.label,
      lines,
      wide: field.wide
    } satisfies WrappedCell;

    if (field.wide) {
      flushRow(currentRow);
      currentRow = [];
      flushRow([wrappedField]);
      return;
    }

    currentRow.push(wrappedField);

    if (currentRow.length === 2) {
      flushRow(currentRow);
      currentRow = [];
    }
  });

  flushRow(currentRow);
}

function drawParagraphs(state: PdfLayoutState, paragraphs: string[]) {
  paragraphs.forEach((paragraph) => {
    const lines = wrapText(
      state.regularFont,
      BODY_FONT_SIZE,
      paragraph,
      CONTENT_WIDTH
    );
    const requiredHeight = lines.length * LINE_HEIGHT + 6;
    ensureSpace(state, requiredHeight);
    drawWrappedLines({
      state,
      lines,
      x: PAGE_MARGIN_X,
      y: state.y,
      font: state.regularFont,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT
    });
    state.y -= requiredHeight;
  });
}

function drawScheduleTable(state: PdfLayoutState, scheduleData: TceScheduleData) {
  const rows = [
    { label: "Segunda-feira", day: scheduleData.monday },
    { label: "Terça-feira", day: scheduleData.tuesday },
    { label: "Quarta-feira", day: scheduleData.wednesday },
    { label: "Quinta-feira", day: scheduleData.thursday },
    { label: "Sexta-feira", day: scheduleData.friday },
    { label: "Sábado", day: scheduleData.saturday }
  ];
  const columnWidths = [145, 150, CONTENT_WIDTH - 295];
  const headerHeight = 24;
  const rowHeight = 24;
  const tableHeight = headerHeight + rows.length * rowHeight;

  ensureSpace(state, tableHeight + 8);

  const tableTop = state.y;
  const headerLabels = ["Dia", "Horário", "Intervalo"];
  let currentX = PAGE_MARGIN_X;

  headerLabels.forEach((label, index) => {
    const width = columnWidths[index] ?? 120;
    state.page.drawRectangle({
      x: currentX,
      y: tableTop - headerHeight,
      width,
      height: headerHeight,
      color: HEADER_FILL,
      borderColor: BORDER_COLOR,
      borderWidth: 0.75
    });
    state.page.drawText(label, {
      x: currentX + 8,
      y: tableTop - 15,
      font: state.boldFont,
      size: LABEL_FONT_SIZE,
      color: TITLE_COLOR
    });
    currentX += width;
  });

  rows.forEach((row, rowIndex) => {
    const baseY = tableTop - headerHeight - rowHeight * rowIndex;
    const values = [
      row.label,
      formatScheduleRange({
        startTime: row.day?.startTime,
        endTime: row.day?.endTime
      }),
      formatScheduleBreak({
        breakStartTime: row.day?.breakStartTime,
        breakEndTime: row.day?.breakEndTime
      })
    ];

    let rowX = PAGE_MARGIN_X;

    values.forEach((value, valueIndex) => {
      const width = columnWidths[valueIndex] ?? 120;
      state.page.drawRectangle({
        x: rowX,
        y: baseY - rowHeight,
        width,
        height: rowHeight,
        color: rgb(1, 1, 1),
        borderColor: BORDER_COLOR,
        borderWidth: 0.75
      });
      state.page.drawText(value, {
        x: rowX + 8,
        y: baseY - 15,
        font: state.regularFont,
        size: BODY_FONT_SIZE,
        color: rgb(0.15, 0.17, 0.22)
      });
      rowX += width;
    });
  });

  state.y = tableTop - tableHeight - 12;
}

function drawSignatureRow(state: PdfLayoutState) {
  const gap = 16;
  const signatureWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const signatureLabels = [
    "Parte Concedente",
    "Estagiário(a)",
    "Instituição de Ensino"
  ];

  ensureSpace(state, 70);

  const lineY = state.y - 24;

  signatureLabels.forEach((label, index) => {
    const x = PAGE_MARGIN_X + index * (signatureWidth + gap);

    state.page.drawLine({
      start: { x, y: lineY },
      end: { x: x + signatureWidth, y: lineY },
      thickness: 1,
      color: BORDER_COLOR
    });
    state.page.drawText(label, {
      x: x + 4,
      y: lineY - 18,
      font: state.boldFont,
      size: SMALL_FONT_SIZE,
      color: MUTED_COLOR
    });
  });

  state.y = lineY - 36;
}

function buildConcedingPartyAddress(data: TceConcedingPartyData) {
  return joinTextParts([
    data.address,
    data.addressNumber,
    data.addressComplement,
    data.neighborhood,
    data.city,
    data.state,
    data.postalCode
  ]);
}

function buildInternshipLocationAddress(data: TceConcedingPartyData) {
  return joinTextParts([
    data.internshipLocation,
    data.internshipLocationAddress,
    data.internshipLocationNumber,
    data.internshipLocationComplement,
    data.internshipLocationNeighborhood,
    data.internshipLocationCity,
    data.internshipLocationState,
    data.internshipLocationPostalCode
  ]);
}

function buildStudentAddress(studentData: TceStudentData) {
  return joinTextParts([
    studentData.address,
    studentData.addressNumber,
    studentData.addressComplement,
    studentData.neighborhood,
    studentData.city,
    studentData.state,
    studentData.postalCode
  ]);
}

export async function buildStudentTcePdfBuffer(input: TcePdfRenderInput) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const state: PdfLayoutState = {
    pdfDoc,
    regularFont,
    boldFont,
    page: pdfDoc.addPage([A4_PAGE_WIDTH, A4_PAGE_HEIGHT]),
    y: A4_PAGE_HEIGHT - PAGE_MARGIN_TOP,
    pageNumber: 1
  };
  const context = input.snapshot.context;
  const fixedData = input.snapshot.fixedData;
  const studentData = input.studentData;

  pdfDoc.setTitle(
    `TCE - ${context.areaName} - ${context.semesterCode}`
  );
  pdfDoc.setSubject("Termo de Compromisso de Estágio");
  pdfDoc.setCreator("Nexus Academy");
  pdfDoc.setProducer("Nexus Academy");

  state.page.drawText("NEXUS ACADEMY", {
    x: PAGE_MARGIN_X,
    y: state.y,
    font: state.boldFont,
    size: 12,
    color: TITLE_COLOR
  });
  state.page.drawText("Termo institucional gerado pelo módulo TCE", {
    x: PAGE_MARGIN_X,
    y: state.y - 16,
    font: state.regularFont,
    size: SMALL_FONT_SIZE,
    color: MUTED_COLOR
  });

  state.page.drawText("TERMO DE COMPROMISSO DE ESTÁGIO (OBRIGATÓRIO)", {
    x: PAGE_MARGIN_X,
    y: state.y - 46,
    font: state.boldFont,
    size: 15,
    color: TITLE_COLOR
  });

  const introLines = wrapText(
    state.regularFont,
    BODY_FONT_SIZE,
    `Documento gerado a partir do modelo ${displayText(input.snapshot.model.name)} para o estágio em ${displayText(context.areaName)}. Esta versão consolida os dados do estagiário e a configuração institucional vigente no momento do preenchimento.`,
    CONTENT_WIDTH
  );

  drawWrappedLines({
    state,
    lines: introLines,
    x: PAGE_MARGIN_X,
    y: state.y - 68,
    font: state.regularFont,
    fontSize: BODY_FONT_SIZE,
    lineHeight: LINE_HEIGHT
  });
  state.y -= 96;

  drawSectionTitle(state, "Parte Concedente");
  drawFieldRows(state, [
    {
      label: "Razão social",
      value: displayText(fixedData.concedingPartyData.corporateName)
    },
    {
      label: "CNPJ/CPF/Código escola",
      value: displayText(fixedData.concedingPartyData.documentNumber)
    },
    {
      label: "Responsável",
      value: displayText(fixedData.concedingPartyData.responsibleName)
    },
    {
      label: "RG ou funcional",
      value: displayText(fixedData.concedingPartyData.responsibleDocument)
    },
    {
      label: "Conselho profissional e número",
      value: displayText(fixedData.concedingPartyData.professionalCouncil)
    },
    {
      label: "Telefone",
      value: displayText(fixedData.concedingPartyData.phone)
    },
    {
      label: "E-mail",
      value: displayText(fixedData.concedingPartyData.email)
    },
    {
      label: "Endereço da concedente",
      value: buildConcedingPartyAddress(fixedData.concedingPartyData),
      wide: true
    },
    {
      label: "Local de estágio",
      value: buildInternshipLocationAddress(fixedData.concedingPartyData),
      wide: true
    }
  ]);

  drawSectionTitle(state, "Estagiário(a)");
  drawFieldRows(state, [
    { label: "Nome", value: displayText(studentData.fullName) },
    { label: "RA", value: displayText(studentData.registration) },
    { label: "Campus/Polo", value: displayText(studentData.campus) },
    { label: "Curso", value: displayText(studentData.courseName) },
    { label: "Semestre", value: displayText(studentData.semesterLabel) },
    { label: "Turno", value: displayText(studentData.shift) },
    { label: "Telefone", value: displayText(studentData.phone) },
    { label: "E-mail", value: displayText(studentData.email) },
    {
      label: "Endereço do estagiário",
      value: buildStudentAddress(studentData),
      wide: true
    }
  ]);

  drawSectionTitle(state, "Instituição de Ensino");
  drawFieldRows(state, [
    {
      label: "Instituição",
      value: displayText(context.institutionName)
    },
    {
      label: "Curso",
      value: displayText(context.courseName)
    },
    {
      label: "Unidade",
      value: displayText(context.unitName)
    },
    {
      label: "Área de estágio",
      value: displayText(context.areaName)
    },
    {
      label: "Turma",
      value: displayText(context.className)
    },
    {
      label: "Semestre acadêmico",
      value: displayText(context.semesterCode)
    }
  ]);

  drawSectionTitle(state, "Vigência");
  drawFieldRows(state, [
    {
      label: "Data inicial",
      value: formatDatePtBr(fixedData.termData.startsAt)
    },
    {
      label: "Data final",
      value: formatDatePtBr(fixedData.termData.endsAt)
    }
  ]);

  drawSectionTitle(state, "Horário de Estágio");
  drawScheduleTable(state, fixedData.scheduleData);

  drawSectionTitle(state, "Jornada");
  drawFieldRows(state, [
    {
      label: "Jornada diária",
      value: displayText(fixedData.dailyWorkload)
    },
    {
      label: "Jornada semanal",
      value: displayText(fixedData.weeklyWorkload)
    },
    {
      label: "Jornada semestral",
      value: displayText(fixedData.semesterWorkload)
    }
  ]);

  drawSectionTitle(state, "Cláusulas contratuais");
  drawParagraphs(state, TCE_CLAUSES);

  drawSectionTitle(state, "Plano de Atividades de Estágio");
  drawParagraphs(state, [
    displayText(
      fixedData.activityPlan,
      "Plano de atividades não informado pela coordenação."
    )
  ]);

  drawSectionTitle(state, "Cidade e Data");
  drawParagraphs(state, [
    `${displayText(fixedData.signatureCity)}, ${formatDatePtBr(fixedData.signatureDate)}`
  ]);

  drawSectionTitle(state, "Assinaturas");
  drawParagraphs(state, [
    "Após a conferência, este documento deve ser impresso e assinado fisicamente pelas partes responsáveis."
  ]);
  drawSignatureRow(state);

  pdfDoc.getPages().forEach((page, pageIndex, pages) => {
    page.drawLine({
      start: { x: PAGE_MARGIN_X, y: 34 },
      end: { x: PAGE_MARGIN_X + CONTENT_WIDTH, y: 34 },
      thickness: 0.75,
      color: BORDER_COLOR
    });
    page.drawText(
      `Nexus Academy - TCE - Página ${pageIndex + 1} de ${pages.length}`,
      {
        x: PAGE_MARGIN_X,
        y: 20,
        font: regularFont,
        size: SMALL_FONT_SIZE,
        color: MUTED_COLOR
      }
    );
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
