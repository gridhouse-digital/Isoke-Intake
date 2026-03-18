import { useEffect } from 'react'

interface DocumentMeta {
  canonical?: string
  description: string
  robots?: string
  title: string
}

export function useDocumentMeta({
  title,
  description,
  canonical,
  robots = 'noindex, nofollow',
}: DocumentMeta) {
  useEffect(() => {
    document.title = title

    const upsertMeta = (selector: string, content: string, attribute = 'name') => {
      let node = document.querySelector<HTMLMetaElement>(selector)
      if (!node) {
        node = document.createElement('meta')
        node.setAttribute(attribute, selector.match(/"(.*)"/)?.[1] ?? '')
        document.head.appendChild(node)
      }
      node.content = content
    }

    upsertMeta('meta[name="description"]', description)
    upsertMeta('meta[property="og:title"]', title, 'property')
    upsertMeta('meta[property="og:description"]', description, 'property')
    upsertMeta('meta[name="twitter:title"]', title)
    upsertMeta('meta[name="twitter:description"]', description)
    upsertMeta('meta[name="robots"]', robots)

    if (canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.href = canonical
    }
  }, [canonical, description, robots, title])
}
