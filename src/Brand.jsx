function Brand({ subtitle, className = '' }) {
  return <div className={`brand ${className}`.trim()}>
    <span className="brand-icon">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 10 9-7 9 7v10H3V10Z" />
        <path d="M9 20v-7h6v7" />
      </svg>
    </span>
    <span><strong>hogar<span>+</span></strong><small>{subtitle}</small></span>
  </div>
}

export default Brand
