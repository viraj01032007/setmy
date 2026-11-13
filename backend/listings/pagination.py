from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """10 per page by default; the frontend can ask for more with ?page_size=N."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 500
