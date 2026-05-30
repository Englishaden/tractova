// 'use client';

import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Monthly recurring revenue',
    value: '$34.1K',
    change: '+6.1%',
    changeType: 'positive',
    href: '#',
  },
  {
    name: 'Users',
    value: '500.1K',
    change: '+19.2%',
    changeType: 'positive',
    href: '#',
  },
  {
    name: 'User growth',
    value: '11.3%',
    change: '-1.2%',
    changeType: 'negative',
    href: '#',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name} className="p-0">
            <div className="px-4 py-4">
              <dd className="flex items-start justify-between space-x-2">
                <span className="truncate text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                  {item.name}
                </span>
                <span
                  className={classNames(
                    item.changeType === 'positive'
                      ? 'text-emerald-700 dark:text-emerald-500'
                      : 'text-red-700 dark:text-red-500',
                    'text-tremor-default font-medium',
                  )}
                >
                  {item.change}
                </span>
              </dd>
              <dd className="mt-1 text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {item.value}
              </dd>
            </div>
            <div className="flex justify-end border-t border-tremor-border px-4 py-3 dark:border-dark-tremor-border">
              <a
                href={item.href}
                className="text-tremor-default font-medium text-tremor-brand hover:text-tremor-brand-emphasis dark:text-dark-tremor-brand hover:dark:text-dark-tremor-brand-emphasis"
              >
                View more &#8594;
              </a>
            </div>
          </Card>
        ))}
      </dl>
    </>
  );
}