export default function GlassCard({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`glass-panel p-4 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
