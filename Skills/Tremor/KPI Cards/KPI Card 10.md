// 'use client';

import { RiCheckLine, RiErrorWarningLine, RiEyeLine } from '@remixicon/react';
import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Daily active users',
    stat: '345',
    status: 'within',
    range: '200-410',
  },
  {
    name: 'Weekly sessions',
    stat: '254',
    status: 'critical',
    range: '550-1,200',
  },
  {
    name: 'Open issues',
    stat: '34',
    status: 'observe',
    range: '10-25',
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
            <dd className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {item.stat}
            </dd>
            <dd
              className={classNames(
                item.status === 'within'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-500'
                  : item.status === 'observe'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500'
                    : 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-500',
                'mt-4 inline-flex items-center gap-x-1.5 rounded-tremor-small px-2 py-1.5 text-tremor-label font-medium',
              )}
            >
              {item.status === 'within' ? (
                <RiCheckLine className="size-4 shrink-0" aria-hidden={true} />
              ) : item.status === 'observe' ? (
                <RiEyeLine className="size-4 shrink-0" aria-hidden={true} />
              ) : (
                <RiErrorWarningLine
                  className="size-4 shrink-0"
                  aria-hidden={true}
                />
              )}
              {item.status}: {item.range}
            </dd>
          </Card>
        ))}
      </dl>
    </>
  );
}