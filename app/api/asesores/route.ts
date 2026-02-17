import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { readExcel } from '@/lib/excel';

const DATA_DIR = 'C:\\Users\\jairo.gelpi\\Desktop\\metricas_carlos\\data';
const ASESORES_FILE = 'lista_asesores.xlsx';

export async function GET() {
    try {
        const data = readExcel(ASESORES_FILE);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read asesores' }, { status: 500 });
    }
}
