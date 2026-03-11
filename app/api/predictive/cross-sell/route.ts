import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        {
            error: 'Predictive module disabled',
            message: 'Cross-sell prediction has been disabled due to insufficient reliability.',
            rules: [],
            stats: {
                totalTransactions: 0,
                totalPolizas: 0,
                avgConfidence: 0,
                numRules: 0
            }
        },
        { status: 410 }
    );
}
