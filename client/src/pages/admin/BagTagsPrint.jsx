import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

const PAGE_SIZE = 10; // 2 cols x 5 rows fits the usable area given the label sheet's margins

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Standalone, chrome-less print page (declared outside AdminLayout in App.jsx) for 3"x2" bag
// tag labels. Tags are passed via router state from the Exports page's Bag Tags tab — this page
// doesn't fetch anything itself, so a direct nav/refresh with no state shows a fallback.
export default function BagTagsPrint() {
  const location = useLocation();
  const tags = location.state?.tags;

  useEffect(() => {
    if (tags && tags.length > 0) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [tags]);

  if (!tags || tags.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <p>No bag tags to print — go back and select events.</p>
        <Link to="/admin/exports" style={{ color: '#3bb889' }}>← Back to Exports</Link>
      </div>
    );
  }

  const pages = chunk(tags, PAGE_SIZE);

  return (
    <div>
      <style>{`
        @page { size: letter; margin: 0.471in 0.2in 0.236in 0in; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media print {
          .no-print { display: none !important; }
        }
        .tag-page {
          display: grid;
          grid-template-columns: repeat(2, 3in);
          grid-auto-rows: 2in;
        }
        .tag-page:not(:last-child) {
          page-break-after: always;
          break-after: page;
        }
        .tag-cell {
          width: 3in;
          height: 2in;
          border: 1px solid #999;
          padding: 0.15in 0.18in;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          font-family: Arial, Helvetica, sans-serif;
          overflow: hidden;
        }
        .tag-title { font-weight: 700; font-size: 13pt; color: #1e3a2f; line-height: 1.15; width: 100%; }
        .tag-line { font-size: 10pt; color: #6B9B37; font-weight: 600; margin-top: 3px; width: 100%; }
        .tag-contents { font-size: 10pt; color: #333; margin-top: 4px; font-weight: 600; width: 100%; }
        .tag-date { font-size: 9pt; color: #666; margin-top: 6px; width: 100%; }
      `}</style>

      <div className="no-print" style={{ padding: '16px 20px', fontFamily: 'Arial, Helvetica, sans-serif', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #eee' }}>
        <Link to="/admin/exports" style={{ color: '#3bb889', textDecoration: 'none', fontSize: 14 }}>← Back to Exports</Link>
        <button
          onClick={() => window.print()}
          style={{ background: '#A8E6CF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
        >
          Print
        </button>
        <span style={{ fontSize: 13, color: '#666' }}>{tags.length} label{tags.length !== 1 ? 's' : ''} · {pages.length} page{pages.length !== 1 ? 's' : ''}</span>
      </div>

      {pages.map((page, pi) => (
        <div className="tag-page" key={pi}>
          {page.map((tag, ti) => (
            <div className="tag-cell" key={ti}>
              <div className="tag-title">
                {tag.title}{tag.bagCount > 1 ? ` — Bag ${tag.bagIndex} of ${tag.bagCount}` : ''}
              </div>
              {tag.pickupLocation ? (
                <div className="tag-line">→ {tag.pickupLocation}</div>
              ) : (
                <div className="tag-line" style={{ color: '#b45309' }}>No deliver-to location set</div>
              )}
              <div className="tag-contents">
                {tag.meals ? `${tag.meals} meals` : ''}
                {tag.meals && tag.snackBites ? ' · ' : ''}
                {tag.snackBites ? `${tag.snackBites} snack bites` : ''}
              </div>
              <div className="tag-date">{formatDate(tag.date)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
