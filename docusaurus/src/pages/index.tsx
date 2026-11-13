import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const example = `import 'typeorm-extensions';

const { list, total, hasMore } = await dataSource
  .getRepository(UserEntity)
  .createQueryBuilder('user')
  .leftJoinTyped(user => user.images, 'images')
  .whereTyped(user => user.createdAt, '>', since)
  .andWhereTyped(user => user.metadata.role, '=', 'admin')
  .orderByTyped(user => user.images.url, 'ASC', 'NULLS LAST')
  .getManyWithTotals({ page: 1, pageSize: 20 });`;

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/overview">
            Getting started
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            to="/playground">
            Try the playground
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Documentation for ${siteConfig.title}`}
      description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <section className={clsx('container', styles.example)}>
          <CodeBlock language="typescript">{example}</CodeBlock>
        </section>
      </main>
    </Layout>
  );
}
