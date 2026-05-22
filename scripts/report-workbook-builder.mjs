import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

function sanitizeSheetName(name) {
  const sanitized = String(name ?? "")
    .replace(/[\\/*?:[\]]/g, " ")
    .trim();

  return sanitized.length > 31 ? sanitized.slice(0, 31) : sanitized || "Planilha";
}

async function buildWorkbook(definition, outputPath) {
  const workbook = Workbook.create();

  definition.sheets.forEach((sheetDefinition, sheetIndex) => {
    const sheet = workbook.worksheets.add(sanitizeSheetName(sheetDefinition.name));
    sheet.showGridLines = false;
    let currentRow = 1;
    const totalColumns = Math.max(
      ...sheetDefinition.tables.map((table) => table.columns.length),
      4
    );
    const lastColumnLetter = String.fromCharCode(64 + Math.min(totalColumns, 26));
    const titleRange = sheet.getRange(`A${currentRow}:${lastColumnLetter}${currentRow}`);
    titleRange.merge();
    titleRange.values = [[sheetDefinition.title]];
    titleRange.format = {
      fill: "#0F766E",
      font: { bold: true, color: "#FFFFFF", size: 15 },
      horizontalAlignment: "left",
      verticalAlignment: "center"
    };
    titleRange.format.rowHeight = 26;
    currentRow += 1;

    if (sheetDefinition.subtitle) {
      const subtitleRange = sheet.getRange(
        `A${currentRow}:${lastColumnLetter}${currentRow}`
      );
      subtitleRange.merge();
      subtitleRange.values = [[sheetDefinition.subtitle]];
      subtitleRange.format = {
        fill: "#E7F4F1",
        font: { color: "#213431", size: 10 },
        wrapText: true
      };
      subtitleRange.format.rowHeight = 28;
      currentRow += 2;
    } else {
      currentRow += 1;
    }

    if (sheetDefinition.metrics?.length) {
      const metricHeaderRange = sheet.getRange(`A${currentRow}:C${currentRow}`);
      metricHeaderRange.values = [["Indicador", "Valor", "Observacao"]];
      metricHeaderRange.format = {
        fill: "#F3F4F6",
        font: { bold: true, color: "#213431" }
      };
      currentRow += 1;
      const metricRows = sheetDefinition.metrics.map((metric) => [
        metric.label,
        metric.value,
        metric.hint ?? ""
      ]);
      const metricRange = sheet.getRange(
        `A${currentRow}:C${currentRow + metricRows.length - 1}`
      );
      metricRange.values = metricRows;
      metricRange.format = {
        wrapText: true,
        verticalAlignment: "top"
      };
      currentRow += metricRows.length + 2;
    }

    sheetDefinition.tables.forEach((table, tableIndex) => {
      const tableTitleRange = sheet.getRange(
        `A${currentRow}:${lastColumnLetter}${currentRow}`
      );
      tableTitleRange.merge();
      tableTitleRange.values = [[table.title]];
      tableTitleRange.format = {
        fill: tableIndex % 2 === 0 ? "#F6F3EC" : "#EAF6F3",
        font: { bold: true, color: "#213431", size: 12 }
      };
      currentRow += 1;

      const headerRowStart = currentRow;
      const headerRowEndLetter = String.fromCharCode(
        64 + Math.min(table.columns.length, 26)
      );
      const headerRange = sheet.getRange(
        `A${headerRowStart}:${headerRowEndLetter}${headerRowStart}`
      );
      headerRange.values = [table.columns];
      headerRange.format = {
        fill: "#0F766E",
        font: { bold: true, color: "#FFFFFF" },
        wrapText: true
      };
      currentRow += 1;

      const rows = table.rows.length ? table.rows : [["Sem dados para exportacao"]];
      const dataRange = sheet.getRange(
        `A${currentRow}:${headerRowEndLetter}${currentRow + rows.length - 1}`
      );
      dataRange.values = rows;
      dataRange.format = {
        wrapText: true,
        verticalAlignment: "top"
      };
      currentRow += rows.length + 2;
    });

    const usedRange = sheet.getUsedRange();

    if (usedRange) {
      usedRange.format.autofitColumns();
      usedRange.format.autofitRows();
    }

    if (sheetIndex === 0) {
      sheet.freezePanes.freezeRows(1);
    }
  });

  const blob = await SpreadsheetFile.exportXlsx(workbook);
  await blob.save(outputPath);
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    throw new Error("Informe o JSON de entrada e o caminho de saida do workbook.");
  }

  const definition = JSON.parse(await fs.readFile(inputPath, "utf8"));
  await buildWorkbook(definition, outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
