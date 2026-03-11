import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        {
            error: 'Predictive module disabled',
            message: 'Predictive ente detail has been disabled due to insufficient reliability.'
        },
        { status: 410 }
    );
}
