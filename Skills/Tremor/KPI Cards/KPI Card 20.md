// 'use client';

import { Card } from '@tremor/react';

const data = [
  {
    name: 'Running',
    stat: '156',
    activities: [
      {
        type: 'Endurance',
        share: '25.5%',
        zone: '<126',
        href: '#',
      },
      {
        type: 'Moderate',
        share: '35.3%',
        zone: '126-157',
        href: '#',
      },
      {
        type: 'Tempo',
        share: '14.2%',
        zone: '157-173',
        href: '#',
      },
      {
        type: 'Threshold',
        share: '25.0%',
        zone: '173-189',
        href: '#',
      },
    ],
  },
  {
    name: 'Cycling',
    stat: '142',
    activities: [
      {
        type: 'Endurance',
        share: '20.2%',
        zone: '<126',
        href: '#',
      },
      {
        type: 'Moderate',
        share: '45.6%',
        zone: '126-157',
        href: '#',
      },
      {
        type: 'Tempo',
        share: '15.7%',
        zone: '157-173',
        href: '#',
      },
      {
        type: 'Threshold',
        share: '18.5%',
        zone: '173-189',
        href: '#',
      },
    ],
  },
  {
    name: 'Strength',
    stat: '113',
    activities: [
      {
        type: 'Endurance',
        share: '80.1%',
        zone: '<126',
        href: '#',
      },
      {
        type: 'Moderate',
        share: '9.9%',
        zone: '126-157',
        href: '#',
      },
      {
        type: 'Tempo',
        share: '6.2%',
        zone: '157-173',
        href: '#',
      },
      {
        type: 'Threshold',
        share: '3.8%',
        zone: '173-189',
        href: '#',
      },
    ],
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <dt className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              {item.name}
            </dt>
            <dd className="flex items-baseline space-x-2 text-tremor-content-strong dark:text-dark-tremor-content-strong">
              <span className="text-tremor-metric font-semibold">
                {item.stat}
              </span>
              <span className="text-tremor-default font-medium">bpm</span>
            </dd>
            <dd className="items-space mt-6 flex justify-between text-tremor-label text-tremor-content dark:text-dark-tremor-content">
              <span>HR zone share</span>
              <span>BPM range</span>
            </dd>
            <ul role="list" className="mt-2 space-y-2">
              {item.activities.map((activity) => (
                <li
                  key={activity.type}
                  className="relative flex w-full items-center space-x-3 rounded-tremor-small bg-tremor-background-subtle/60 p-1 hover:bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle/60 hover:dark:bg-dark-tremor-background-subtle"
                >
                  <span className="inline-flex w-20 justify-center rounded bg-sky-500 py-1.5 text-tremor-default font-semibold text-tremor-brand-inverted dark:text-dark-tremor-brand-inverted">
                    {activity.share}
                  </span>
                  <p className="flex w-full items-center justify-between space-x-4 truncate text-tremor-default font-medium">
                    <span className="truncate text-tremor-content dark:text-dark-tremor-content">
                      <a href={activity.href} className="focus:outline-none">
                        {/* Extend link to entire card */}
                        <span className="absolute inset-0" aria-hidden={true} />
                        {activity.type}
                      </a>
                    </span>
                    <span className="pr-1.5 text-tremor-content-strong dark:text-dark-tremor-content-strong">
                      {activity.zone}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </dl>
    </>
  );
}