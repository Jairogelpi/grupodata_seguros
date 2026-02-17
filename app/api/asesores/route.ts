import { NextResponse } from 'next/server';
import { readData } from '@/lib/storage';

export async function GET() {
    try {
        const data = await readData('lista_asesores.xlsx');
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read asesores' }, { status: 500 });
    }
}
