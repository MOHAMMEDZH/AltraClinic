import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { buildBreadcrumbs } from '../routing/breadcrumbs';

/** Breadcrumb trail derived from the route registry. Renders nothing for single-level routes. */
export function Breadcrumbs() {
  const location = useLocation();
  const { t } = useI18n();
  const items = buildBreadcrumbs(location.pathname, t);

  if (items.length < 2) return null;

  return (
    <nav aria-label={t('a11y.breadcrumb', 'Breadcrumb')} className="sa-breadcrumbs">
      <ol>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={item.id}>
              <li>
                {isLast ? (
                  <span aria-current="page">{item.label}</span>
                ) : (
                  <Link to={item.path}>{item.label}</Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
