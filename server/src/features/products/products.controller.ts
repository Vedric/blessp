import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service';
import { CreateProductSchema, UpdateProductSchema, ProductQuerySchema, UpdateVariantsSchema } from './products.schema';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../core/types/response';

export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = ProductQuerySchema.parse(req.query);
      const result = await this.productsService.listProducts(query);

      sendPaginated(res, req, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await this.productsService.getProduct(req.params.id as string);

      sendSuccess(res, req, product);
    } catch (error) {
      next(error);
    }
  };

  filters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = await this.productsService.getFilters();

      sendSuccess(res, req, filters);
    } catch (error) {
      next(error);
    }
  };

  featured = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.productsService.getFeaturedProducts();

      sendSuccess(res, req, products);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateProductSchema.parse(req.body);
      const product = await this.productsService.createProduct(dto);

      sendCreated(res, req, product);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateProductSchema.parse(req.body);
      const product = await this.productsService.updateProduct(req.params.id as string, dto);

      sendSuccess(res, req, product);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.productsService.deleteProduct(req.params.id as string);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  completeLook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await this.productsService.getCompleteLook(req.params.id as string);

      sendSuccess(res, req, products);
    } catch (error) {
      next(error);
    }
  };

  getVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variants = await this.productsService.getVariants(req.params.id as string);

      sendSuccess(res, req, variants);
    } catch (error) {
      next(error);
    }
  };

  updateVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateVariantsSchema.parse(req.body);
      const variants = await this.productsService.updateVariants(
        req.params.id as string,
        dto.variants,
      );

      sendSuccess(res, req, variants);
    } catch (error) {
      next(error);
    }
  };
}
