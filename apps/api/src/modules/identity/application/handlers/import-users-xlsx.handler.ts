import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ImportUsersHandler, ImportUserRow } from './import-users.handler';

@Injectable()
export class ImportUsersXlsxHandler {
  constructor(private readonly csvImport: ImportUsersHandler) {}

  async execute(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Excel file has no worksheets');

    const rows: ImportUserRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const email = String(row.getCell(1).text ?? '').trim();
      const firstName = String(row.getCell(2).text ?? '').trim();
      const lastName = String(row.getCell(3).text ?? '').trim();
      const rolesRaw = String(row.getCell(4).text ?? '').trim();
      const password = String(row.getCell(5).text ?? '').trim();
      if (!email && !firstName && !lastName) return;
      rows.push({
        email,
        firstName,
        lastName,
        roles: rolesRaw ? rolesRaw.split(/[;,]/).map((r) => r.trim()).filter(Boolean) : undefined,
        password: password || undefined,
      });
    });

    if (!rows.length) throw new BadRequestException('No data rows found in Excel file');
    return this.csvImport.execute(rows);
  }
}
