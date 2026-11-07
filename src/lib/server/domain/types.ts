// SPDX-License-Identifier: EUPL-1.2

export type BookingMode = 'slot' | 'unit' | 'capacity' | 'day';

export type Interval = { startsAt: Date; endsAt: Date };
export type Slot = { startsAt: Date; endsAt: Date };

/** weekday: 0 = luns … 6 = domingo; opens/closes en 'HH:mm' hora local. */
export type Hours = { weekday: number; opens: string; closes: string };

export type BookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'attended';
