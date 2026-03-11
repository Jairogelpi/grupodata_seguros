import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        {
            error: 'Predictive module disabled',
            message: 'Churn prediction has been disabled due to insufficient reliability.',
            riskList: [],
            stats: {
                avgChurn: 0,
                totalActive: 0,
                totalPolizas: 0,
                atHighRisk: 0,
                highRiskPct: 0
            }
        },
        { status: 410 }
    );
}
