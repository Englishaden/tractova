// 'use client';

import { RiArrowDownSFill, RiArrowUpSFill } from '@remixicon/react';
import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Daily active users',
    stat: '3,450',
    change: '12.1%',
    changeType: 'positive',
  },
  {
    name: 'Weekly sessions',
    stat: '1,342',
    change: '9.8%',
    changeType: 'negative',
  },
  {
    name: 'Duration',
    stat: '5.2min',
    change: '7.7%',
    changeType: 'positive',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <div className="flex items-center justify-between">
              <dt className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
                {item.name}
              </dt>
              <dd
                className={classNames(
                  item.changeType === 'positive'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-500'
                    : 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-500',
                  'inline-flex items-center gap-x-1 rounded-tremor-small px-1.5 py-0.5 text-tremor-label font-medium',
                )}
              >
                {item.changeType === 'positive' ? (
                  <RiArrowUpSFill
                    className="-ml-0.5 size-4 shrink-0"
                    aria-hidden={true}
                  />
                ) : (
                  <RiArrowDownSFill
                    className="-ml-0.5 size-4 shrink-0"
                    aria-hidden={true}
                  />
                )}
                {item.change}
              </dd>
            </div>
            <dd className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {item.stat}
            </dd>
          </Card>
        ))}
      </dl>
    </>
  );
}