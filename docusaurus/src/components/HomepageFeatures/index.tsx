import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  to: string;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Typed queries',
    to: '/docs/api/typed/',
    description: (
      <>
        Select, join, filter, group and order with property callbacks checked against your entities:
        a renamed column is a compile error, not a failed query.
      </>
    ),
  },
  {
    title: 'Pagination',
    to: '/docs/api/pagination/',
    description: (
      <>
        A page with its total and <code>hasMore</code> in one call, or keyset pages with an opaque
        cursor, on entities and on raw rows.
      </>
    ),
  },
  {
    title: 'SQL helpers and columns',
    to: '/docs/api/utils/tableHelper/',
    description: (
      <>
        <code>tableHelper</code> quotes the raw SQL you still write, a guard catches reserved words, and{' '}
        <code>@CalculatedColumn</code> / <code>@GeneratedColumn</code> describe values TypeORM never writes.
      </>
    ),
  },
];

function Feature({title, to, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md">
        <Heading as="h3">
          <Link to={to}>{title}</Link>
        </Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
