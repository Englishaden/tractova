// 'use client';

import { Card, ProgressCircle } from '@tremor/react';

const data = [
  {
    name: 'HR',
    progress: 25,
    budget: '$1,000',
    current: '$250',
    href: '#',
  },
  {
    name: 'Marketing',
    progress: 55,
    budget: '$1,000',
    current: '$550',
    href: '#',
  },
  {
    name: 'Finance',
    progress: 85,
    budget: '$1,000',
    current: '$850',
    href: '#',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name} className="p-0">
            <div className="flex items-center space-x-3 px-6 pt-6">
              <ProgressCircle value={item.progress} radius={25} strokeWidth={5}>
                <span className="text-tremor-label font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {item.progress}&#37;
                </span>
              </ProgressCircle>
              <div>
                <dd className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {item.current} / {item.budget}
                </dd>
                <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                  Budget {item.name}
                </dt>
              </div>
            </div>
            <div className="mt-8 flex items-center justify-end border-t border-tremor-border px-6 py-3 dark:border-dark-tremor-border">
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