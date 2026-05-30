export const runtime = "nodejs";

function buildCsvLine(values: string[]) {
  return values
    .map((value) => {
      if (/[",;\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    })
    .join(";");
}

export async function GET() {
  const rows = [
    ["nome_completo", "ra", "celular", "email"],
    ["Aluno Exemplo", "20260001", "16987623457", "aluno.exemplo@nexus.edu.br"]
  ];
  const content = `\uFEFF${rows.map(buildCsvLine).join("\n")}`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-importacao-alunos.csv"',
      "Cache-Control": "no-store"
    }
  });
}
