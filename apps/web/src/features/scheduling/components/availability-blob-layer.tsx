import { createUniqueId, Index } from 'solid-js';
import { timeMinutes } from '../core/availability';
import type { TimeWindow } from '../core/types';

export type AvailabilityBlob = { window: TimeWindow; gray: boolean };

function BlobGroup(props: {
  blobs: AvailabilityBlob[];
  filter?: string;
  foreground: boolean;
}) {
  return (
    <div
      class="pointer-events-none absolute inset-y-0 inset-x-1.5"
      classList={{ 'z-1': props.foreground }}
      style={{ filter: props.filter }}
    >
      <Index each={props.blobs}>
        {(blob) => (
          <div
            class="absolute inset-x-0 min-h-4 rounded-lg"
            classList={{
              'bg-accent': !blob().gray,
              'bg-edge': blob().gray,
              'transition-[top,height] duration-300 ease-out motion-reduce:transition-none':
                !!props.filter,
            }}
            style={{
              top: `${(timeMinutes(blob().window.start) / 1440) * 100}%`,
              height: `${((timeMinutes(blob().window.end) - timeMinutes(blob().window.start)) / 1440) * 100}%`,
            }}
          />
        )}
      </Index>
    </div>
  );
}

/** Filter shapes, not text. Separate type groups cannot join opposing bars. */
export function AvailabilityBlobLayer(props: {
  available: AvailabilityBlob[];
  unavailable: AvailabilityBlob[];
  joining?: 'available' | 'unavailable';
  preview?: 'available' | 'unavailable';
}) {
  const filterId = `availability-goo-${createUniqueId()}`;
  const filter = (mode: 'available' | 'unavailable') =>
    props.joining === mode ? `url(#${filterId})` : undefined;
  return (
    <>
      <svg aria-hidden="true" class="pointer-events-none absolute size-0">
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-2%"
            width="140%"
            height="104%"
            color-interpolation-filters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <BlobGroup
        blobs={props.available}
        filter={filter('available')}
        foreground={props.preview === 'available'}
      />
      <BlobGroup
        blobs={props.unavailable}
        filter={filter('unavailable')}
        foreground={props.preview === 'unavailable'}
      />
    </>
  );
}
