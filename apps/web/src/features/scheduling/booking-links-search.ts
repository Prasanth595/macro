import { z } from 'zod';

export const bookingLinksSearch = {
  namespace: 'booking-links',
  schema: z.object({
    tab: z.enum(['links', 'availability', 'bookings', 'insights']),
    owner: z.string(),
  }),
  defaults: { tab: 'links' as const, owner: '' },
};

export type BookingLinksState = z.infer<typeof bookingLinksSearch.schema>;
