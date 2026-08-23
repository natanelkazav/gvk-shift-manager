import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createPortal,
} from 'react-dom';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useAuth,
} from '../../auth/AuthContext';

import {
  helpGroupLabels,
  helpTopics,
} from '../../help/helpRegistry';

import {
  helpWhatsNewItems,
} from '../../help/helpWhatsNew';

import type {
  HelpTopic,
} from '../../help/helpTypes';

import '../../styles/helpCenter.css';

function topicIsVisible(
  topic:
    HelpTopic,

  hasPermission:
    ReturnType<
      typeof useAuth
    >['hasPermission'],
): boolean {
  const anyPermissions =
    topic.requiredAnyPermissions ??
    [];

  const allPermissions =
    topic.requiredAllPermissions ??
    [];

  const matchesAny =
    anyPermissions.length ===
      0 ||
    anyPermissions.some(
      (
        permission,
      ) =>
        hasPermission(
          permission,
        ),
    );

  const matchesAll =
    allPermissions.every(
      (
        permission,
      ) =>
        hasPermission(
          permission,
        ),
    );

  return (
    matchesAny &&
    matchesAll
  );
}

function topicMatchesRoute(
  topic:
    HelpTopic,

  pathname:
    string,

  search:
    string,
): boolean {
  const pathMatches =
    topic.routePrefixes
      .includes(
        '/',
      ) &&
    pathname ===
      '/'
      ? true
      : topic.routePrefixes
          .some(
            (
              prefix,
            ) =>
              prefix !== '/' &&
              pathname.startsWith(
                prefix,
              ),
          );

  if (!pathMatches) {
    return false;
  }

  if (
    !topic.contextualQuery
  ) {
    return true;
  }

  const params =
    new URLSearchParams(
      search,
    );

  return Object.entries(
    topic.contextualQuery,
  ).every(
    ([
      key,
      expectedValue,
    ]) =>
      params.get(
        key,
      ) ===
        expectedValue,
  );
}

function normalizeSearchValue(
  value:
    string,
): string {
  return value
    .trim()
    .toLocaleLowerCase(
      'he-IL',
    );
}

function topicMatchesSearch(
  topic:
    HelpTopic,

  searchValue:
    string,
): boolean {
  if (!searchValue) {
    return true;
  }

  const searchableText = [
    topic.title,
    topic.summary,
    ...topic.steps,
    ...(topic.notes ?? []),
    ...(topic.keywords ?? []),
  ]
    .join(' ')
    .toLocaleLowerCase(
      'he-IL',
    );

  return searchableText
    .includes(
      searchValue,
    );
}

function HelpCenter() {
  const {
    hasPermission,
  } =
    useAuth();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(
      false,
    );

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    expandedTopicId,
    setExpandedTopicId,
  ] =
    useState<string | null>(
      null,
    );

  const contentRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const visibleTopics =
    useMemo(
      () =>
        helpTopics.filter(
          (
            topic,
          ) =>
            topicIsVisible(
              topic,
              hasPermission,
            ),
        ),
      [
        hasPermission,
      ],
    );

  const visibleWhatsNewItems =
    useMemo(
      () =>
        helpWhatsNewItems.filter(
          (
            item,
          ) =>
            !item.requiredAnyPermissions
              ?.length ||
            item.requiredAnyPermissions
              .some(
                (
                  permission,
                ) =>
                  hasPermission(
                    permission,
                  ),
              ),
        ),
      [
        hasPermission,
      ],
    );

  const contextualTopics =
    useMemo(
      () =>
        visibleTopics.filter(
          (
            topic,
          ) =>
            topicMatchesRoute(
              topic,
              location.pathname,
              location.search,
            ),
        ),
      [
        location.pathname,
        location.search,
        visibleTopics,
      ],
    );

  const normalizedSearch =
    normalizeSearchValue(
      searchQuery,
    );

  const filteredTopics =
    useMemo(
      () =>
        visibleTopics.filter(
          (
            topic,
          ) =>
            topicMatchesSearch(
              topic,
              normalizedSearch,
            ),
        ),
      [
        normalizedSearch,
        visibleTopics,
      ],
    );

  const groupedTopics =
    useMemo(
      () => {
        const groups =
          new Map<
            HelpTopic['group'],
            HelpTopic[]
          >();

        for (
          const topic
          of filteredTopics
        ) {
          const currentItems =
            groups.get(
              topic.group,
            ) ?? [];

          currentItems.push(
            topic,
          );

          groups.set(
            topic.group,
            currentItems,
          );
        }

        return Array.from(
          groups.entries(),
        );
      },
      [
        filteredTopics,
      ],
    );

  useEffect(
    () => {
      if (!isOpen) {
        return;
      }

      const handleEscape =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
              'Escape'
          ) {
            setIsOpen(
              false,
            );
          }
        };

      window.addEventListener(
        'keydown',
        handleEscape,
      );

      return () => {
        window.removeEventListener(
          'keydown',
          handleEscape,
        );
      };
    },
    [
      isOpen,
    ],
  );

  useEffect(
    () => {
      if (!isOpen) {
        return;
      }

      const previousOverflow =
        document.body.style.overflow;

      document.body.style.overflow =
        'hidden';

      return () => {
        document.body.style.overflow =
          previousOverflow;
      };
    },
    [
      isOpen,
    ],
  );

  useEffect(
    () => {
      if (!isOpen) {
        return;
      }

      contentRef.current?.scrollTo({
        top: 0,
        behavior: 'auto',
      });
    },
    [
      isOpen,
      normalizedSearch,
    ],
  );

  const defaultContextualTopicId =
    contextualTopics[0]
      ?.id ??
    null;

  const effectiveExpandedTopicId =
    expandedTopicId ??
    (
      isOpen
        ? defaultContextualTopicId
        : null
    );

  const goToTopic =
    (
      topic:
        HelpTopic,
    ): void => {
      setIsOpen(
        false,
      );

      void navigate(
        topic.route,
      );
    };

  const renderTopic =
    (
      topic:
        HelpTopic,

      compact =
        false,
    ) => {
      const isExpanded =
        effectiveExpandedTopicId ===
        topic.id;

      return (
        <article
          key={
            topic.id
          }
          className={[
            'help-center-topic',
            compact
              ? 'help-center-topic-contextual'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className="help-center-topic-toggle"
            aria-expanded={
              isExpanded
            }
            onClick={() => {
              setExpandedTopicId(
                isExpanded
                  ? ''
                  : topic.id,
              );
            }}
          >
            <span>
              <strong>
                {topic.title}
              </strong>

              <small>
                {topic.summary}
              </small>
            </span>

            <ChevronDown
              size={18}
              aria-hidden="true"
              className={
                isExpanded
                  ? 'help-center-topic-chevron help-center-topic-chevron-open'
                  : 'help-center-topic-chevron'
              }
            />
          </button>

          {isExpanded ? (
            <div className="help-center-topic-content">
              <ol>
                {topic.steps.map(
                  (
                    step,
                    index,
                  ) => (
                    <li
                      key={
                        `${topic.id}-${index}`
                      }
                    >
                      {step}
                    </li>
                  ),
                )}
              </ol>

              {topic.notes
                ?.length ? (
                  <div className="help-center-topic-notes">
                    {topic.notes.map(
                      (
                        note,
                      ) => (
                        <p
                          key={
                            note
                          }
                        >
                          {note}
                        </p>
                      ),
                    )}
                  </div>
                ) : null}

              <button
                type="button"
                className="help-center-go-button"
                onClick={() => {
                  goToTopic(
                    topic,
                  );
                }}
              >
                <ExternalLink
                  size={16}
                  aria-hidden="true"
                />

                עבור למסך
              </button>
            </div>
          ) : null}
        </article>
      );
    };

  return (
    <>
      <button
        type="button"
        className="help-center-trigger"
        aria-label="פתיחת מרכז העזרה"
        aria-expanded={
          isOpen
        }
        aria-haspopup="dialog"
        title="מרכז העזרה"
        onClick={() => {
          setExpandedTopicId(
            null,
          );

          setIsOpen(
            true,
          );
        }}
      >
        <HelpCircle
          size={22}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {isOpen
        ? createPortal(
            <>
              <button
            type="button"
            className="help-center-backdrop"
            aria-label="סגירת מרכז העזרה"
            onClick={() => {
              setIsOpen(
                false,
              );
            }}
          />

          <aside
            className="help-center-panel"
            role="dialog"
            aria-modal="true"
            aria-label="מרכז העזרה"
          >
            <header className="help-center-header">
              <div className="help-center-heading">
                <span className="help-center-heading-icon">
                  <BookOpen
                    size={21}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <strong>
                    מרכז העזרה
                  </strong>

                  <span>
                    ההסברים מותאמים להרשאות שלך
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="help-center-close"
                aria-label="סגירת מרכז העזרה"
                onClick={() => {
                  setIsOpen(
                    false,
                  );
                }}
              >
                <X
                  size={21}
                  aria-hidden="true"
                />
              </button>
            </header>

            <div className="help-center-search">
              <Search
                size={18}
                aria-hidden="true"
              />

              <input
                type="search"
                value={
                  searchQuery
                }
                placeholder="חיפוש פעולה או נושא..."
                aria-label="חיפוש במרכז העזרה"
                onChange={(
                  event,
                ) => {
                  setSearchQuery(
                    event.target.value,
                  );
                }}
              />
            </div>

            <div
              ref={contentRef}
              className="help-center-content"
            >
              {!normalizedSearch &&
              visibleWhatsNewItems.length >
                0 ? (
                  <section className="help-center-whats-new">
                    <div className="help-center-section-heading">
                      <strong>
                        חדש במערכת
                      </strong>

                      <span>
                        עדכונים שרלוונטיים להרשאות שלך
                      </span>
                    </div>

                    <div className="help-center-whats-new-list">
                      {visibleWhatsNewItems.map(
                        (
                          item,
                        ) => (
                          <article
                            key={
                              item.id
                            }
                          >
                            <strong>
                              {item.title}
                            </strong>

                            <span>
                              {item.description}
                            </span>
                          </article>
                        ),
                      )}
                    </div>
                  </section>
                ) : null}

              {!normalizedSearch ? (
                <aside className="help-center-permission-hint">
                  <strong>
                    לא מוצא פעולה?
                  </strong>

                  <span>
                    ייתכן שהפעולה אינה מופיעה כי לא הוקצתה לך ההרשאה המתאימה. מרכז העזרה מציג רק יכולות שרלוונטיות להרשאות שלך.
                  </span>
                </aside>
              ) : null}

              {!normalizedSearch &&
              contextualTopics.length >
                0 ? (
                  <section className="help-center-context-section">
                    <div className="help-center-section-heading">
                      <strong>
                        עזרה במסך הנוכחי
                      </strong>

                      <span>
                        הפעולות הזמינות לך כאן
                      </span>
                    </div>

                    <div className="help-center-topic-list">
                      {contextualTopics.map(
                        (
                          topic,
                        ) =>
                          renderTopic(
                            topic,
                            true,
                          ),
                      )}
                    </div>
                  </section>
                ) : null}

              <section className="help-center-all-section">
                <div className="help-center-section-heading">
                  <strong>
                    {normalizedSearch
                      ? 'תוצאות חיפוש'
                      : 'כל נושאי העזרה'}
                  </strong>

                  <span>
                    {filteredTopics.length} נושאים זמינים עבורך
                  </span>
                </div>

                {groupedTopics.length >
                0 ? (
                  <div className="help-center-groups">
                    {groupedTopics.map(
                      ([
                        group,
                        topics,
                      ]) => (
                        <section
                          key={
                            group
                          }
                          className="help-center-group"
                        >
                          <h3>
                            {
                              helpGroupLabels[
                                group
                              ]
                            }
                          </h3>

                          <div className="help-center-topic-list">
                            {topics.map(
                              (
                                topic,
                              ) =>
                                renderTopic(
                                  topic,
                                ),
                            )}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="help-center-empty">
                    לא נמצאו נושאי עזרה שמתאימים לחיפוש ולהרשאות שלך.
                  </div>
                )}
              </section>
            </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

export default HelpCenter;