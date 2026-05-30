// 'use client';

import { RiExternalLinkLine } from '@remixicon/react';
import { Card, ProgressCircle } from '@tremor/react';

const data = [
  {
    name: 'Workspaces',
    capacity: 20,
    current: 1,
    allowed: 5,
  },
  {
    name: 'Dashboards',
    capacity: 10,
    current: 2,
    allowed: 20,
  },
  {
    name: 'Chart widgets',
    capacity: 0,
    current: 0,
    allowed: 50,
  },
];

export default function Example() {
  return (
    <>
      <h2 className="text-tremor-title font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
        Plan overview
      </h2>
      <p className="mt-1 text-tremor-default leading-6 text-tremor-content dark:text-dark-tremor-content">
        You are currently on the{' '}
        <span className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
          starter plan
        </span>
        .{' '}
        <a
          href="#"
          className="inline-flex items-center gap-1 text-tremor-brand hover:underline hover:underline-offset-4 dark:text-dark-tremor-brand"
        >
          View other plans
          <RiExternalLinkLine className="size-4" aria-hidden={true} />
        </a>
      </p>
      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <div className="flex items-center space-x-3">
              <ProgressCircle value={item.capacity} radius={25} strokeWidth={5}>
                <span className="text-tremor-label font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {item.capacity}&#37;
                </span>
              </ProgressCircle>
              <div>
                <dt className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  {item.name}
                </dt>
                <dd className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                  {item.current} of {item.allowed} used
                </dd>
              </div>
            </div>
          </Card>
        ))}
      </dl>
    </>
  );
}