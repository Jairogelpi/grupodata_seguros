import { NextResponse } from 'next/server';
import { getEntes, addEnte } from '@/lib/registry';

export async function GET() {
    try {
        const data = await getEntes();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read entes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // body should match: { Código, Nombre, Tipo, Año1 }
        const data = await addEnte(body);
        return NextResponse.json({ success: true, count: data.length });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message || 'Failed to save ente' }, { status: 500 });
    }
}
