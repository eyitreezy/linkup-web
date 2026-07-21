import {
  loadPlanForShareCard,
  planShareOgPriceLabel,
} from '@/lib/plans/planShareCard.server';
import { planShareCity, planShareHostFirstName } from '@/lib/plans/planSharePreview';
import { isSupabaseConfigured } from '@/lib/env';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

const BRAND_PRIMARY = '#6c63ff';
const BRAND_SECONDARY = '#ff6584';

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const { id: planId } = await params;

  if (!isSupabaseConfigured) {
    return new Response('Not configured', { status: 503 });
  }

  const { data: plan, error } = await loadPlanForShareCard(planId);

  if (error) {
    return new Response('Plan not found', { status: 404 });
  }
  if (!plan) {
    return new Response('Plan not found', { status: 404 });
  }

  const meetTypeName = plan.meet_types?.name ?? 'Meetup';
  const city = planShareCity(plan.location_label);
  const meetDate = plan.scheduled_at
    ? new Date(plan.scheduled_at).toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : 'Date TBC';
  const priceDisplay = planShareOgPriceLabel(plan);
  const title = plan.title?.trim() || `${meetTypeName} in ${city}`;
  const hostName = planShareHostFirstName(plan.creator?.display_name);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%)`,
            padding: '60px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '32px',
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: BRAND_PRIMARY }}>LinkUp</span>
              <span
                style={{
                  background: '#EEF2FF',
                  color: BRAND_PRIMARY,
                  padding: '6px 16px',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Verified Meetup
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '16px', color: '#6B7280', fontWeight: 600 }}>{meetTypeName}</span>
              <span style={{ fontSize: '36px', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
                {title}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px', color: '#374151', fontWeight: 600 }}>{meetDate}</span>
              <span style={{ fontSize: '18px', color: '#374151', fontWeight: 600 }}>{city}</span>
              {priceDisplay ? (
                <span
                  style={{
                    background: '#F0FDF4',
                    color: '#059669',
                    padding: '8px 20px',
                    borderRadius: '50px',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {priceDisplay}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '16px', color: '#6B7280' }}>Hosted by</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{hostName}</span>
              <span style={{ fontSize: '14px', color: BRAND_PRIMARY, fontWeight: 600 }}>Verified</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[plan card]', err);
    }
    return new Response('Failed to generate image', { status: 500 });
  }
}
